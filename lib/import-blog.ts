import { ulid } from 'https://deno.land/std@0.203.0/ulid/mod.ts'
import { parseMicroformats } from '../deps/microformats-parser.ts'
import { MF2Object, mf2Url } from './common/mf2.ts'
import { createPost } from './db.ts'
import { Post } from './model/post.ts'
import { enqueue, QueueMessage } from './queue.ts'
import * as storage from './storage.ts'
import { Element } from '../deps/dom.ts'

export const importBlog = async (feedUrl: string) => {
	const res = await fetch(feedUrl)
	const html = await res.text()
	const mf2 = parseMicroformats({ html, baseUrl: res.url ?? feedUrl })
	const hfeed = mf2.items.find((item) => item.type.includes('h-feed'))
	if (!hfeed) throw new Error('No h-feed on given page')
	const hentries = hfeed.children?.filter((item) =>
		item.type.includes('h-entry')
	)
	if (!hentries) return
	Promise.all(hentries.map((item) =>
		enqueue({
			type: 'import_post',
			post: item,
		})
	))
}

export const importPost = async (hentry: MF2Object) => {
	const post = Post.fromMF2Json(hentry)
	const messages: QueueMessage[] = []
	post.mutateDom((content) =>
		content.querySelectorAll('img[src]').forEach((node) => {
			const el = node as Element
			const sourceUrl = el.getAttribute('src')!
			const destUrl = ulid(post.published.getTime())
			el.setAttribute('src', destUrl)
			messages.push({ type: 'import_media', sourceUrl, destUrl })
		})
	)
	messages.forEach(enqueue)
	await createPost(post)
}

export const importMedia = async (sourceUrl: string, destUrl: string) => {
	const res = await fetch(sourceUrl)
	const blob = await res.blob()
	await storage.write(destUrl, blob)
}
