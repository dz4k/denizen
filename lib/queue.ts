import { MF2Object } from './common/mf2.ts'
import { db } from './db.ts'
import {
	BlogImportJob,
	importBlog,
	importEntry,
	importMedia,
} from './import-blog.ts'
import { Entry } from './model/entry.ts'
import {
	receiveWebmention,
	sendWebmention,
	sendWebmentions,
} from './webmention/webmention.ts'

export type QueueMessage = {
	type: 'send_webmentions'
	source: string
	targets: Set<string>
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
	job: BlogImportJob
} | {
	type: 'import_entry'
	jobId: string
	entryId: string
} | {
	type: 'import_media'
	jobId: string
	oldUrl: string
	newUrl: string
}

export const enqueue = (message: QueueMessage) => db.enqueue(message)

export const listen = () =>
	db.listenQueue((x) => {
		const message = x as QueueMessage

		switch (message.type) {
			case 'send_webmentions':
				return sendWebmentions(message.source, message.targets)
			case 'send_webmention':
				return sendWebmention(message.source, message.target)
			case 'recv_webmention':
				return receiveWebmention(message.source, message.target)
			case 'import_blog':
				return importBlog(message.job)
			case 'import_entry':
				return importEntry(message.jobId, message.entryId)
			case 'import_media':
				return importMedia(message.jobId, message.oldUrl, message.newUrl)
		}
	})
