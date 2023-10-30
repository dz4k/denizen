import { DOMParser, Element } from '../deps/dom.ts'
import { parseLinkHeader } from '../deps/parse-link-header.ts'

import { db } from './db.ts'
import { Citation, Post } from './model.ts'
import * as config from './config.ts'

db.listenQueue(async (message) => {
	if (
		!message || typeof message !== 'object' ||
		!('type' in message)
	) return

	if (message.type === 'send_webmentions') {
		if (!('post' in message && typeof message.post === 'object')) {
			console.warn(
				`${message.type} message received, but the specified post is not a post`,
				message,
			)
			return
		}
		await sendWebmentions(Post.fromMF2Json(message.post))
	} else if (message.type === 'send_webmention') {
		if (
			!('source' in message && typeof message.source === 'string' &&
				'target' in message && typeof message.target === 'string')
		) {
			console.warn(
				`Invalid ${message.type} message`,
				message,
			)
			return
		}
		await sendWebmention(message.source, message.target)
	}
})

export async function sendWebmentions(post: Post) {
	const mentionedPages = findMentions(post)
	console.log(`Found mentioned pages:`, mentionedPages, 'in post', post)
	await Promise.all(Array.from(mentionedPages, (page) =>
		db.enqueue({
			type: 'send_webmention',
			source: post.uid!.href,
			target: page,
		})))
}

function findMentions(post: Post) {
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
		const doc = new DOMParser().parseFromString(post.content, 'text/html')
		doc?.querySelectorAll('a[href]').forEach((node) => {
			const el = node as Element
			if (el.getAttribute('rel')?.includes('nomention')) return
			try {
				add(new URL(el.getAttribute('href')!, post.uid))
			} catch {
				// invalid URL
				// TODO: maybe post a warning?
			}
		})
	}

	return urls
}

export async function sendWebmention(source: string, target: string) {
	console.log('Sending webmention from', source, 'to', target)
	const endpoint = await discoverWebmentionEndpoint(target)
	console.log('Found webmention endpoint of', target, ':', endpoint)
	if (!endpoint) return
	await fetch(endpoint, {
		method: 'POST',
		body: new URLSearchParams({ source, target }),
	})
}

async function discoverWebmentionEndpoint(target: string | Request | URL) {
	const res = await fetch(target)
	for (const [header, value] of res.headers.entries()) {
		if (header === 'link') {
			const parsed = parseLinkHeader(value)
			for (const link of parsed) {
				console.log(target, 'Link:', link)
				const rel = (link.rel as string ?? '').toLowerCase().split(/\s+/g)
				if (rel.includes('webmention')) {
					return new URL(link.uri, res.url ?? target)
				}
			}
		}
	}
	try {
		const html = await res.text()
		const doc = load(html, { baseURI: res.url })
		const link = doc('[rel~="webmention" i][href]')
		const url = link?.attr('href')
		if (typeof url === 'string') return new URL(url, res.url ?? target)
	} catch (e) {
		console.error(e)
		return null
	}
}
