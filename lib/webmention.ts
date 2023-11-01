import { DOMParser, Element } from '../deps/dom.ts'
import { parseLinkHeader } from '../deps/parse-link-header.ts'

import { deleteWebmention, getPostByURL, saveWebmention } from './db.ts'
import { Citation, Post, Webmention, WMResponseType } from './model.ts'
import { parseMicroformats } from '../deps/microformats-parser.ts'
import { MF2Object } from './common/mf2.ts'
import { isValidUrl } from './common/util.ts'
import { enqueue } from './queue.ts'
import * as config from './config.ts'
import { app } from './denizen.ts'

export const receiveWebmention = async (source: string, target: string) => {
	const targetPost = await getPostByURL(new URL(target))
	if (!targetPost) {
		console.error(
			'Webmention received for nonexistent post',
			target,
			'from',
			source,
		)
		return
	}

	const sourceRes = await fetchInternalOrExternal(new Request(source))

	if (sourceRes.status === 410 /* "Gone" */) {
		await deleteWebmention({ source, target })
		return
	}

	if (!sourceRes.ok) {
		console.error(
			'Webmention source returned HTTP error',
			sourceRes.status,
			source,
			target,
		)
		return
	}

	const sourceContent = await sourceRes.text()
	const doc = new DOMParser().parseFromString(sourceContent, 'text/html')
	const mentioningElement = doc?.querySelector(
		`[href=${JSON.stringify(target)}]`,
	)
	if (!mentioningElement) {
		console.info(
			'Webmention source does not mention target',
			source,
			target,
		)
		await deleteWebmention({ source, target })
		return
	}

	const mf2doc = await parseMicroformats({
		// TODO: The HTML is parsed twice.
		// Write own MF2 parser that works with deno_dom to avoid this.
		html: sourceContent,
		baseUrl: sourceRes.url || source,
	})
	console.log('Parsed mf2', source, mf2doc)

	const hEntry = mf2doc.items.find((item) => item.type.includes('h-entry'))
	if (!hEntry) {
		console.error(
			'Mentioning page is not an h-entry, Other kinds of mentions are not yet supported',
			source,
			target,
		)
		return
	}

	const webmentionPost = Post.fromMF2Json(hEntry)

	console.log('Createw webmention post', source, webmentionPost)

	const responseType = discoverResponseType(hEntry)

	const wm = new Webmention(
		source,
		target,
		responseType,
		webmentionPost,
	)

	await saveWebmention(targetPost, wm)
}

/**
 * https://www.w3.org/TR/post-type-discovery/#response-algorithm
 */
const discoverResponseType = (hEntry: MF2Object): WMResponseType => {
	// TODO: support rsvp
	if (
		'repost-of' in hEntry.properties &&
		isValidUrl(hEntry.properties['repost-of'][0])
	) return 'repost'
	if (
		'like-of' in hEntry.properties &&
		isValidUrl(hEntry.properties['like-of'][0])
	) return 'like'
	if (
		'in-reply-to' in hEntry.properties &&
		isValidUrl(hEntry.properties['in-reply-to'][0])
	) return 'reply'
	return 'mention'
}

export async function sendWebmentions(post: Post, oldContent?: string) {
	const mentionedPages = findMentions(post, oldContent)
	console.log(`Found mentioned pages:`, mentionedPages, 'in post', post)
	await Promise.all(Array.from(mentionedPages, (page) =>
		enqueue({
			type: 'send_webmention',
			source: post.uid!.href,
			target: page,
		})))
}

function findMentions(post: Post, oldContent?: string) {
	const urls = new Set<string>()
	const add = (url: URL) => {
		urls.add(url.href)
	}
	const addCitation = (cite: Citation) => {
		if (cite.uid) add(cite.uid)
		cite.url.forEach(add)
	}
	post.bookmarkOf.forEach(addCitation)
	post.inReplyTo.forEach(addCitation)
	post.likeOf.forEach(addCitation)

	if (post.content) {
		for (
			const mention of findMentionsInContent(post.content.html, {
				baseUrl: post.uid!,
			})
		) add(mention)
	}
	if (oldContent) {
		for (
			const mention of findMentionsInContent(oldContent, { baseUrl: post.uid! })
		) add(mention)
	}

	return urls
}

function* findMentionsInContent(
	content: string,
	{ baseUrl }: { baseUrl: URL },
) {
	const doc = new DOMParser().parseFromString(content, 'text/html')
	if (!doc) return
	for (const node of doc.querySelectorAll('a[href]')) {
		const el = node as Element
		if (el.getAttribute('rel')?.includes('nomention')) return
		try {
			yield new URL(el.getAttribute('href')!, baseUrl)
		} catch {
			// invalid URL
			// TODO: maybe post a warning?
		}
	}
}

export async function sendWebmention(source: string, target: string) {
	console.log('Sending webmention from', source, 'to', target)
	const endpoint = await discoverWebmentionEndpoint(new URL(target))
	console.log('Found webmention endpoint of', target, ':', endpoint)
	if (!endpoint) return
	await fetchInternalOrExternal(
		new Request(endpoint, {
			method: 'POST',
			body: new URLSearchParams({ source, target }),
		}),
	)
}

async function discoverWebmentionEndpoint(target: URL) {
	const res = await fetchInternalOrExternal(
		new Request(target, {
			headers: {
				'expect': 'text/html',
			},
		}),
	)
	for (const [header, value] of res.headers.entries()) {
		console.log(target, header + ':', value)
		if (header === 'link') {
			const parsed = parseLinkHeader(value)
			for (const link of parsed) {
				console.log(target, 'Link:', link)
				const rel = (link.rel as string ?? '').toLowerCase().split(/\s+/g)
				if (rel.includes('webmention')) {
					return new URL(link.uri, res.url || target)
				}
			}
		}
	}
	try {
		const html = await res.text()
		console.log('html', html)
		const doc = new DOMParser().parseFromString(html, 'text/html')
		const link = doc?.querySelector('[rel~="webmention" i][href]')
		const url = link?.getAttribute('href')
		if (typeof url === 'string') return new URL(url, res.url ?? target)
	} catch (e) {
		console.error(e)
		return null
	}
}

const fetchInternalOrExternal = (req: Request) => {
	const myFetch = new URL(req.url).hostname === config.baseUrl.hostname
		? app.fetch
		: fetch
	return myFetch(req)
}
