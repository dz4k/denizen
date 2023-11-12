import { MF2Object } from './common/mf2.ts'
import { db, logError } from './db.ts'
import { importBlog, importMedia, importPost } from './import-blog.ts'
import { Post } from './model/post.ts'
import {
	receiveWebmention,
	sendWebmention,
	sendWebmentions,
} from './webmention.ts'

export type QueueMessage = {
	type: 'send_webmentions'
	post: MF2Object
	oldHtml?: string
} | {
	type: 'send_webmention'
	source: string
	target: string
} | {
	type: 'recv_webmention'
	source: string
	target: string
} | {
	type: 'import_blog'
	feedUrl: string
} | {
	type: 'import_post'
	post: MF2Object
} | {
	type: 'import_media'
	sourceUrl: string
	destUrl: string
}

export const enqueue = (message: QueueMessage) => db.enqueue(message)

export const listen = () =>
	db.listenQueue((x) => {
		const message = x as QueueMessage

		switch (message.type) {
			case 'send_webmentions':
				return sendWebmentions(Post.fromMF2Json(message.post), message.oldHtml)
			case 'send_webmention':
				return sendWebmention(message.source, message.target)
			case 'recv_webmention':
				return receiveWebmention(message.source, message.target)
			case 'import_blog':
				return importBlog(message.feedUrl)
			case 'import_post':
				return importPost(message.post)
			case 'import_media':
				return importMedia(message.sourceUrl, message.destUrl)
		}
	})
