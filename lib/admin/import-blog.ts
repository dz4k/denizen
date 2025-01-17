import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { getBlogImportJob, saveBlogImportJob } from '../db.ts'
import { enqueue } from '../queue.ts'
import { clientRedirect } from '../common/util.ts'

export const get = (c: hono.Context<Env>) => {
	return c.var.render('import-form.vto')
}

export const post = async (c: hono.Context<Env>) => {
	const body = await c.req.parseBody()
	if (typeof body['feed-url'] !== 'string') {
		c.status(400)
		return c.var.render('import-form.vto', { error: 'Please specify an URL' })
	}
	let feedUrl
	try {
		feedUrl = new URL(body['feed-url'])
	} catch {
		c.status(400)
		return c.var.render('import-form.vto', { error: 'Invalid feed URL' })
	}

	const job = await saveBlogImportJob({
		feedUrl: feedUrl.href,
		status: 'starting',
	})
	await enqueue({
		type: 'import_blog',
		job,
	})
	return c.html(clientRedirect(`/.denizen/import-blog/${job.id}`))
}

export const getJob = async (c: hono.Context<Env>) => {
	const jobId = c.req.param('id')
	const job = await getBlogImportJob(jobId)
	return c.var.render('import-job.vto', { job })
}
