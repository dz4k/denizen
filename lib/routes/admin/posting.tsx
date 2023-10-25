/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import { Post } from '../../model.ts'
import { makeSlug } from '../../common/slug.ts'
import * as config from '../../config.ts'
import { createPost, getPost, getPostByURL } from '../../db.ts'

export const get = (c: hono.Context<Env>) =>
	c.html(<PostEditor title='New post' />)

export const getEdit = async (c: hono.Context<Env>) => {
	let post
	try {
		const postPath = c.req.query('post')
		post = await getPostByURL(new URL(postPath!, config.baseUrl))
	} catch {
		// invalid URL given
	}
	if (!post) return c.notFound()
	return c.html(
		<PostEditor
			title='Edit'
			post={post}
		/>,
	)
}

export const post = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()

	const post = Post.fromFormData(formdata)
	post.uid = new URL(
		`${post.published.getFullYear()}/${
			post.name ? makeSlug(post.name) : post.published.toISOString()
		}`,
		config.baseUrl, // TODO derive this somehow
	)
	await createPost(post)

	return c.redirect(post.uid!.pathname, 307)
}

export const PostEditor = (p: { title: string; post?: Post }) => (
	<Layout title={p.title}>
		<header>
			<h1>{p.title}</h1>
		</header>
		<main>
			<script type='module' src='/.denizen/public/post-editor.js'></script>
			{p.post
				? (
					<form hx-put={p.post.uid?.pathname} hx-target='main' hx-select='main'>
						<post-editor
							values={p.post && JSON.stringify(p.post.toMF2Json().properties)}
						/>
					</form>
				)
				: (
					<form method='POST'>
						<post-editor />
					</form>
				)}
		</main>
	</Layout>
)
