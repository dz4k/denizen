/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import { Post } from '../../model/post.ts'
import { makeSlug } from '../../common/slug.ts'
import { parseHashtags } from '../../common/hashtag.ts'
import * as config from '../../config.ts'
import { createPost, getPostByURL } from '../../db.ts'

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
	const { tags, html } = parseHashtags(post.content!.html)
	post.content!.html = html
	post.category.push(...tags)
	await createPost(post)

	if (c.req.header('HX-Request')) {
		return c.body(null, 200, { 'HX-Redirect': post.uid!.pathname })
	} else {
		return c.redirect(post.uid!.pathname, 303)
	}
}

export const PostEditor = (p: { title: string; post?: Post }) => (
	<Layout title={p.title}>
		<header>
			<h1>{p.title}</h1>
		</header>
		<main>
			<script type='module' src='/.denizen/public/post-editor.js'></script>
			<form method='POST' class='grid' style='grid: auto-flow / auto 1fr'>
				<p class='grid-row'>
					<label for='edit-title'>Title</label>
					<input type='text' name='name' id='edit-title' value={p.post?.name} />
				</p>
				<p class='grid-row'>
					<label for='edit-content'>Content</label>
					<textarea name='content' id=''>{p.post?.content?.html}</textarea>
				</p>
				<details open={!!p.post?.summary}>
					<summary>Add summary</summary>
					<label for='edit-summary'>Summary</label>
					<input
						type='text'
						name='name'
						id='edit-title'
						value={p.post?.summary}
					/>
				</details>
				<p class='grid-row'>
					<button type='submit'>Post</button>
				</p>
			</form>
		</main>
	</Layout>
)
