import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'
import { Layout } from '../layout.ts'

import { Entry } from '../model/entry.ts'
import { makeSlug } from '../common/slug.ts'
import { parseHashtags } from '../common/hashtag.ts'
import * as config from '../config.ts'
import { createPost, getPostByURL } from '../db.ts'
import * as blogPost from './post.tsx'
import { clientRedirect } from '../common/util.ts'

export const get = (c: hono.Context<Env>) =>
	c.html(
		<PostEditor
			theme={c.var.theme}
			title='New post'
			post={Entry.fromFormData(formDataFromObject(c.req.query()))}
		/>,
	)

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
	return c.html(
		<PostEditor
			theme={c.var.theme}
			title='Edit'
			post={post}
		/>,
	)
}

export const postEdit = (c: hono.Context<Env>) => {
	const postPath = c.req.query('post')
	if (!postPath) return c.notFound()

	return blogPost.put(c, new URL(postPath, config.baseUrl))
}

export const post = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()
	console.log(formdata)

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

export const PostEditor = (
	p: { title: string; post?: Entry; theme: string },
) => (
	<Layout title={p.title} theme={p.theme}>
		<header>
			<h1>{p.title}</h1>
		</header>
		<main>
			<script type='module' src='/.denizen/public/post-editor.js'></script>
			<form method='POST' class='grid' style='grid: auto-flow / auto 1fr'>
				{p.post?.inReplyTo
					? p.post.inReplyTo.map((cite) => (
						<p class='grid-row'>
							<label for='edit-in-reply-to'>
								<span aria-hidden='true'>↪</span> Reply to
							</label>
							<input
								type='url'
								name='in-reply-to'
								id='edit-in-reply-to'
								value={cite.url}
							/>
							<span>
								{cite.author?.map((author) => (
									<span>
										{author.name},{' '}
									</span>
								))}
								{cite.name
									? <cite>{cite.name}</cite>
									: cite.content
									? <span>{cite.content.slice(0, 40)}</span>
									: <span>{cite.url}</span>}
							</span>
						</p>
					))
					: ''}
				<p class='grid-row'>
					<label for='edit-title'>Title</label>
					<input type='text' name='name' id='edit-title' value={p.post?.name} />
				</p>
				<p class='grid-row'>
					<label for='edit-content'>Content</label>
					<textarea name='content' id='edit-content'>
						{p.post?.content?.html}
					</textarea>
				</p>
				<details style='grid-column: 1 / 3' open={!!p.post?.summary}>
					<summary>Add summary</summary>
					<p class='grid' style='grid: auto-flow / auto 1fr'>
						<label for='edit-summary'>Summary</label>
						<input
							type='text'
							name='summary'
							id='edit-summary'
							value={p.post?.summary}
						/>
					</p>
				</details>
				<details style='grid-column: 1 / 3'>
					<summary>Advanced</summary>
					<p class='grid' style='grid: auto-flow / auto 1fr'>
						<label for='edit-lang'>Language</label>
						{/* TODO: Make this a <select> when multiple site locales is impld. */}
						<input
							name='lang'
							id='edit-lang'
							value={p.post?.lang ?? config.lang()}
						/>
					</p>
				</details>
				<p class='grid-row'>
					<button type='submit'>Post</button>
				</p>
			</form>
		</main>
	</Layout>
)
