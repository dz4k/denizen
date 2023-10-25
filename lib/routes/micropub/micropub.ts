import * as path from 'https://deno.land/std@0.203.0/path/extname.ts'

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import * as config from '../../config.ts'
import * as storage from '../../storage.ts'
import { createPost, deletePost, getPostByURL, updatePost } from '../../db.ts'
import { Post } from '../../model.ts'
import { isAdmin } from '../admin/middleware.ts'
import { makeSlug } from "../../common/slug.ts"

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

/**
 * Authorize Micropub requests.
 */
export const middleware: hono.MiddlewareHandler<Env> = async (c, next) => {
	if (isAdmin(c)) {
		// Authorized via session.
		return next()
	}

	// Authorize via IndieAuth
	let token
	try {
		const formdata = await c.req.parseBody()
		token = formdata['access_token']
	} catch {
		// no formdata
	}
	if (!token) {
		const auth = c.req.header('Authorization')
		if (!(auth && auth.startsWith('Bearer'))) {
			return unauthorized(c)
		}
		token = auth.slice(7)
	}
	const auth = await fetch('https://tokens.indieauth.com/token', {
		method: 'GET',
		headers: {
			'Accept': 'application/json',
			'Authorization': `Bearer ${token}`,
		},
	}).then((res) => res.json())
	const { me, scope } = auth

	if (me !== config.baseUrl.href) return forbidden(c)

	c.set('authScopes', (scope as string).split(/\s+/g))

	return next()
}

export const get = async (c: hono.Context<Env>) => {
	const q = c.req.query('q')
	if (q === 'config') {
		return c.json({
			'media-endpoint':
				new URL('/.denizen/micropub/media', config.baseUrl).href,
		})
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
}
export const post = async (c: hono.Context<Env>) => {
	if (!c.var.authScopes.includes('create')) return forbidden(c)

	const data = await c.req.parseBody()
	const formdata = new FormData()
	for (const [name, value] of Object.entries(data)) {
		if (Array.isArray(value)) {
			for (const val of value) formdata.append(name, val)
		} else {
			formdata.append(name, value)
		}
	}
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
	// TODO: This is duplicated from routes/admin/posting.tsx#post.
	// Factor out and move somewhere sensible.
	post.uid ??= new URL(
		`${post.published.getFullYear()}/${
			post.name ? makeSlug(post.name) : post.published.toISOString()
		}`,
		config.baseUrl, // TODO derive this somehow
	)
	await createPost(post)

	return c.body('', 201, {
		'Location': post.uid!.href,
	})
}

export const postMedia = async (c: hono.Context<Env>) => {
	if (!c.var.authScopes.includes('create')) return forbidden(c)
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
}

const badRequest = (c: hono.Context) =>
	c.json({ error: 'invalid_request' }, 400)
const unauthorized = (c: hono.Context) => c.json({ error: 'unauthorized' }, 401)
const forbidden = (c: hono.Context) => c.json({ error: 'forbidden' }, 403)
// const insufficientScope = (c: hono.Context) =>
// 	c.json({ error: 'insufficient_scope' }, 403)
