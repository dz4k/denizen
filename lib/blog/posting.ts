import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { Entry } from '../model/entry.ts'
import { makeSlug } from '../common/slug.ts'
import { parseHashtags } from '../common/hashtag.ts'
import * as config from '../config.ts'
import { createPost, getPostByURL } from '../db.ts'
import * as blogPost from './post.ts'
import { clientRedirect } from '../common/util.ts'

export const get = (c: hono.Context<Env>) => {
	c.set('title', 'New post')
	return c.var.render('post-editor.vto', {
	  post: Entry.fromFormData(formDataFromObject(c.req.query()))
	});
}

const formDataFromObject = (obj: Record<string, string | string[]>) => {
	const formdata = new FormData()
	for (const [key, value] of Object.entries(obj)) {
		if (Array.isArray(value)) {
			for (const v of value) formdata.append(key, v)
		} else {
			formdata.append(key, value)
		}
	}
	return formdata
}

export const getEdit = async (c: hono.Context<Env>) => {
	let post
	try {
		const postPath = c.req.query('post')
		post = await getPostByURL(new URL(postPath!, config.baseUrl))
	} catch {
		// invalid URL given
	}
	if (!post) return c.notFound()
	c.set('title', 'Edit')
	return c.var.render('post-editor.vto', { post })
}

export const postEdit = (c: hono.Context<Env>) => {
	const postPath = c.req.query('post')
	if (!postPath) return c.notFound()

	return blogPost.put(c, new URL(postPath, config.baseUrl))
}

export const post = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()

	const post = Entry.fromFormData(formdata)
	post.uid = new URL(
		`${post.published.getFullYear()}/${
			post.name ? makeSlug(post.name) : post.published.toISOString()
		}`,
		config.baseUrl, // TODO derive this somehow
	)
	const { tags, html } = parseHashtags(post.content!.html)
	post.content!.html = html
	post.category.push(...tags)
	await createPost(post)

	if (c.req.header('Soiree')) {
		return c.html(clientRedirect(post.uid.pathname))
	} else {
		return c.redirect(post.uid!.pathname, 303)
	}
}
