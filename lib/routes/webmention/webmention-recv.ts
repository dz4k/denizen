import { assert } from 'https://deno.land/std@0.203.0/assert/assert.ts'
import { DOMParser } from '../../../deps/dom.ts'
import { parseMicroformats } from '../../../deps/microformats-parser.ts'

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'

import { db, getPostByURL, saveWebmention } from '../../db.ts'
import * as config from '../../config.ts'
import { Post, Webmention, WMResponseType } from '../../model.ts'
import { MF2Object } from '../../common/mf2.ts'
import { isValidUrl } from '../../common/util.ts'

const supportedSchemes = new Set(['http:', 'https:'])

export const post = async (c: hono.Context<Env>) => {
	const { source, target } = await c.req.parseBody()

	// Validate URLs
	try {
		const sourceUrl = new URL(source.toString())
		assert(supportedSchemes.has(sourceUrl.protocol))
	} catch {
		return c.json({ error: 'invalid_source' }, 400)
	}
	try {
		const targetUrl = new URL(target.toString())
		assert(supportedSchemes.has(targetUrl.protocol))
		assert(targetUrl.host === config.baseUrl.host)
	} catch {
		return c.json({ error: 'invalid_target' }, 400)
	}

	// Reject self mentions
	if (source === target) {
		return c.json({ error: 'source_same_as_target' }, 400)
	}

	// Enqueue mention
	await db.enqueue({ type: 'recv_webmention', source, target })

	return c.body(null, 202)
}

db.listenQueue(async (message) => {
	if (
		!message || typeof message !== 'object' ||
		!('type' in message)
	) return

	if (message.type === 'recv_webmention') {
		if (
			!(
				'source' in message &&
				typeof message.source === 'string' &&
				'target' in message &&
				typeof message.target === 'string'
			)
		) {
			console.warn(`Malformed ${message.type} message:`, message)
			return
		}

		const { source, target } = message

		const targetPost = await getPostByURL(new URL(target))
		if (!targetPost) {
			console.error('Webmention received for nonexistent post', message)
			return
		}

		const sourceRes = await fetch(source)
		if (!sourceRes.ok) {
			console.error(
				'Webmention source returned HTTP error',
				sourceRes.status,
				message,
			)
			return
		}

		const sourceContent = await sourceRes.text()
		const doc = new DOMParser().parseFromString(sourceContent, 'text/html')
		const mentioningElement = doc?.querySelector(
			`[href=${JSON.stringify(target)}]`,
		)
		if (!mentioningElement) {
			console.error('Webmention source doesn\'t mention target', message)
			return
		}

		const mf2doc = await parseMicroformats({
			// TODO: The HTML is parsed twice.
			// Write own MF2 parser that works with deno_dom to avoid this.
			html: sourceContent,
			baseUrl: sourceRes.url,
		})
		console.log('Parsed mf2', source, mf2doc)

		const hEntry = mf2doc.items.find((item) => item.type.includes('h-entry'))
		if (!hEntry) {
			console.error(
				'Mentioning page is not an h-entry, Other kinds of mentions are not yet supported',
				message,
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
})

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
