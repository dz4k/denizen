import * as path from 'https://deno.land/std@0.203.0/path/extname.ts'
import * as mediaType from 'https://deno.land/std@0.203.0/media_types/mod.ts'

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import * as config from '../../config.ts'
import * as storage from '../../storage.ts'
import {
	createPost,
	deletePost,
	getPostByURL,
	undeletePost,
	updatePost,
} from '../../db.ts'
import { Post } from '../../model.ts'
import { isAdmin } from '../admin/middleware.ts'
import { makeSlug } from '../../common/slug.ts'

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

	const [mime] = mediaType.parseMediaType(c.req.header('Content-Type')!)
	const reqBody = mime === 'application/json'
		? await c.req.json()
		: await c.req.parseBody()

	if (reqBody.action === 'delete') {
		if (!c.var.authScopes.includes('update')) return insufficientScope(c)
		let url
		try {
			url = new URL(reqBody.url)
		} catch {
			return badRequest(c)
		}
		const post = await getPostByURL(url)
		if (!post) return c.json({ error: 'not_found' }, 404)
		await deletePost(post)
		return c.body('', 200)
	} else if (reqBody.action === 'undelete') {
		if (!c.var.authScopes.includes('update')) return insufficientScope(c)
		let url
		try {
			url = new URL(reqBody.url)
		} catch {
			return badRequest(c)
		}
		const post = await getPostByURL(url)
		if (!post) return c.json({ error: 'not_found' }, 404)
		await undeletePost(post)
		return c.body('', 200)
	} else if (reqBody.action === 'update') {
		if (
			!(typeof reqBody.replace === 'object' ||
				typeof reqBody.add === 'object' ||
				typeof reqBody.delete === 'object')
		) {
			return badRequest(c)
		}
		const post = await getPostByURL(new URL(reqBody.url))
		if (!post) return badRequest(c)
		if (reqBody.replace) post.replace(reqBody.replace)
		if (reqBody.add) post.add(reqBody.add)
		if (reqBody.delete) post.delete(reqBody.delete)
		await updatePost(post)
		return c.body(null, 204)
	} else {
		// Create post
		if (!c.var.authScopes.includes('create')) return insufficientScope(c)
		const createdPost = mime === 'application/json'
			? Post.fromMF2Json(await c.req.json())
			: Post.fromFormData(await c.req.formData())
		// TODO: This is duplicated from routes/admin/posting.tsx#post.
		// Factor out and move somewhere sensible.
		// also make customizable.
		createdPost.uid ??= new URL(
			`${createdPost.published.getFullYear()}/${
				createdPost.name
					? makeSlug(createdPost.name)
					: createdPost.published.toISOString()
			}`,
			config.baseUrl, // TODO derive this somehow
		)
		await createPost(createdPost)

		return c.body('', 201, {
			'Location': createdPost.uid!.href,
		})
	}
}

export const postMedia = async (c: hono.Context<Env>) => {
	if (!c.var.authScopes.includes('media')) return forbidden(c)
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
const insufficientScope = (c: hono.Context) =>
	c.json({ error: 'insufficient_scope' }, 401)
