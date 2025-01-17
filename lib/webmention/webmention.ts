import { DOMParser, Element } from '../../deps/dom.ts'
import { parseLinkHeader } from '../common/parse-link-header.ts'

import { deleteWebmention, getConfig, getPostByURL, saveWebmention } from '../db.ts'
import { Entry } from '../model/entry.ts'
import { Webmention, WMResponseType } from '../model/webmention.ts'
import { Citation } from '../model/citation.ts'
import parseMicroformats from '../mf2/mf2-parser.ts'
import { MF2Object, MF2PropertyValue } from '../common/mf2.ts'
import { isValidUrl } from '../common/util.ts'
import { enqueue } from '../queue.ts'
import { app } from '../denizen.ts'
import * as config from '../config.ts'

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
	const doc = new DOMParser().parseFromString(sourceContent, 'text/html')!
	const mentioningElement = doc.querySelector(
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

	const mf2doc = await parseMicroformats(doc, {
		baseUrl: sourceRes.url || source,
	})
	const hEntry = mf2doc.items.find((item) => item.type.includes('h-entry'))
	if (!hEntry) {
		console.error(
			'Mentioning page is not an h-entry, Other kinds of mentions are not yet supported',
			source,
			target,
		)
		return
	}

	const webmentionPost = Entry.fromMF2Json(hEntry)

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
		hasValidUrl(hEntry.properties['repost-of'])
	) return 'repost'
	if (
		'like-of' in hEntry.properties &&
		hasValidUrl(hEntry.properties['like-of'])
	) return 'like'

	// TODO: check if it's a reply to the target
	const entry = Entry.fromMF2Json(hEntry)
	if (entry.inReplyTo.length) return 'reply'

	return 'mention'
}

const hasValidUrl = (prop: MF2PropertyValue[]): boolean => prop.some((val) => {
  if (isValidUrl(val)) return true
  if ('properties' in val) {
    return val.properties.uid && hasValidUrl(val.properties.uid) ||
      val.properties.url && hasValidUrl(val.properties.url)
  }
  return false
})

export const sendWebmentions = (source: string, targets: Set<string>) =>
  Promise.all(targets.values().map((target) =>
		enqueue({
			type: 'send_webmention',
			source,
			target,
		})
  )).then((res) => void res)
// const mentionedPages = findMentions(post, oldContent)

export const findMentions = (post: Entry, oldContent?: string) => {
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

const findMentionsInContent = function* (
	content: string,
	{ baseUrl }: { baseUrl: URL },
) {
	const doc = new DOMParser().parseFromString(content, 'text/html')
	if (!doc) return
	for (const node of doc.querySelectorAll('a[href]')) {
		const el = node as Element
		if (el.getAttribute('rel')?.includes('nomention')) return
		try {
			const url = new URL(el.getAttribute('href')!, baseUrl)
			url.hash = ""
			yield url
		} catch {
			// invalid URL
			// TODO: maybe post a warning?
		}
	}
}

export const sendWebmention = async (source: string, target: string) => {
	const endpoint = await discoverWebmentionEndpoint(new URL(target))
	if (!endpoint) return
	await fetchInternalOrExternal(
		new Request(endpoint, {
			method: 'POST',
			body: new URLSearchParams({ source, target }),
		}),
	)
}

const discoverWebmentionEndpoint = async (target: URL) => {
	try {
		const res = await fetchInternalOrExternal(
			new Request(target, {
				headers: {
					'Accept': 'text/html',
				},
			}),
		)
		for (const [header, value] of res.headers.entries()) {
			if (header === 'link') {
				const parsed = parseLinkHeader(value)
				for (const link of parsed) {
					const rel = (link.rel as string ?? '').toLowerCase().split(/\s+/g)
					if (rel.includes('webmention')) {
						return new URL(link.href, res.url || target)
					}
				}
			}
		}

		const html = await res.text()
		const doc = new DOMParser().parseFromString(html, 'text/html')
		const link = doc?.querySelector('[rel~="webmention" i][href]')
		const url = link?.getAttribute('href')
		if (typeof url === 'string') return new URL(url, res.url || target)
	} catch (e) {
		console.error(e)
		return null
	}
}

const fetchInternalOrExternal = async (req: Request) => {
  const baseUrl = new URL(await getConfig('base url') as string);
	const myFetch = new URL(req.url).hostname === baseUrl.hostname
		? app.fetch
		: fetch

	req.headers.set('User-Agent', config.userAgent)
	return myFetch(req)
}
