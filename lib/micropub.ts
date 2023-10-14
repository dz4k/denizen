import * as path from 'https://deno.land/std@0.203.0/path/extname.ts'

import { Context, Hono } from '../deps/hono.ts'
import { Env } from './server.tsx'
import * as config from './config.ts'
import * as storage from './storage.tsx'
import { createPost, deletePost, getPostByURL, updatePost } from './db.ts'
import { Post } from './model.ts'
import { write } from './storage.tsx'

/*
    A conforming Micropub server:

        MUST support both header and form parameter methods of authentication
        MUST support creating posts with the [h-entry] vocabulary
        MUST support creating posts using the x-www-form-urlencoded syntax
        SHOULD support updating and deleting posts
        Servers that support updating posts MUST support JSON syntax and the source content query
        Servers that do not specify a Media Endpoint MUST support multipart/form-data requests for creating posts
        Servers that specify a Media Endpoint MUST support the configuration query, other servers SHOULD support the configuration query
 */

export const installMicropub = (app: Hono<Env>) => {
	app.get('/', async (c) => {
		const q = c.req.query('q')
		if (q === 'config') {
			return {
				'media-endpoint':
					new URL('/.denizen/micropub/media', config.baseUrl).href,
			}
		}
		if (q === 'source') {
			let url
			try {
				url = new URL(c.req.query('url')!)
			} catch {
				return badRequest(c)
			}
			const post = await getPostByURL(new URL(url))
			return c.json(post?.toMF2Json())
		}
        return c.json({ error: 'query_not_implemented' }, 400)
	})
	app.post('/', async (c) => {
		const formdata = await c.req.formData()
		// Remove array brackets
		for (const [key, value] of formdata) {
			if (key.endsWith('[]')) {
				formdata.set(key.slice(0, -2), value)
			}
		}

		if (formdata.has('h') && formdata.get('h') !== 'entry') return badRequest(c)

		if (formdata.get('action') === 'delete') {
			let url
			try {
				url = new URL(c.req.query('url')!)
			} catch {
				return badRequest(c)
			}
			const post = await getPostByURL(url)
			if (!post) return c.json({ error: 'not_found' }, 404)
			await deletePost(post)
			return c.body('', 200)
		}

		if (formdata.get('action') === 'undelete') {
			let url
			try {
				url = new URL(c.req.query('url')!)
			} catch {
				return badRequest(c)
			}
			const post = await getPostByURL(url)
			if (!post) return c.json({ error: 'not_found' }, 404)
			post.deleted = false
			await updatePost(post)
			return c.body('', 200)
		}

		// Create post
		const post = Post.fromFormData(formdata)
		await createPost(post)

		return c.body('', 201, {
			'Location': post.uid!.href,
		})
	})

	app.post('/media', async (c) => {
		const formdata = await c.req.formData()
		const file = formdata.get('file')
		if (!file || !(file instanceof File)) return badRequest(c)
		const name = crypto.randomUUID() + path.extname(file.name)
		await storage.write(name, file)
		return c.body('', 201, {
			'Location':
				new URL(`/.denizen/storage/${encodeURIComponent(name)}`, config.baseUrl)
					.href,
		})
	})
}

const badRequest = (c: Context) => c.json({ error: 'invalid_request' }, 400)
