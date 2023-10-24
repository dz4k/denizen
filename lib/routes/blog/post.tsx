/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import * as config from '../../config.ts'
import { deletePost, getPostByURL } from '../../db.ts'
import { isAdmin } from '../admin/middleware.ts'

const accessPost = (c: hono.Context<Env>) =>
	getPostByURL(new URL(c.req.path, config.baseUrl))

export const get = async (c: hono.Context<Env>) => {
	const post = await accessPost(c)
	if (post === null) return c.notFound()

	if (/application\/(mf2\+)json/i.test(c.req.header('Expect')!)) {
		if (post.deleted) return c.json({ deleted: true }, 410)
		return c.json(post.toMF2Json())
	}

	if (post.deleted) return c.html(<PostDeleted />, 410) // "Gone"
	const admin = isAdmin(c)
	return c.html(
		<Layout
			title={post.name ?? post.summary ??
				post.published.toLocaleTimeString()}
		>
			<article class='h-entry'>
				<header class='container padding-block-start'>
					{post.name ? <h1 class='p-name'>{post.name}</h1> : ''}
					{post.summary
						? (
							<p
								class='big italic'
								dangerouslySetInnerHTML={{ __html: post.summary }}
							/>
						)
						: ''}
					<div class='<small>'>
						<p>
							<a href={post.uid} class='u-url u-uid'>
								<time class='dt-published'>
									{post.published.toLocaleString(config.locales)}
								</time>
							</a>
						</p>
						{post.updated
							? <p>Updated on {post.updated.toLocaleString(config.locales)}</p>
							: ''}
					</div>
				</header>
				<main
					class='e-content'
					dangerouslySetInnerHTML={{ __html: post.content }}
				>
				</main>
				<footer>
					{admin
						? (
							<div class='margin-block f-row align-items:center'>
								<form hx-delete={post.uid!.pathname} class='contents'>
									<button>Delete</button>
								</form>
							</div>
						)
						: ''}
				</footer>
			</article>
		</Layout>,
	)
}

export const del = async (c: hono.Context<Env>) => {
	const post = await accessPost(c)
	if (post === null) return c.notFound()
	await deletePost(post)
	if (c.req.header('HX-Request')) {
		c.header('HX-Redirect', '/')
		return c.body('')
	}
	return c.redirect('/', 303)
}

const PostDeleted = () => (
	<Layout title='Deleted post'>
		<main>
			<p>
				There's nothing here... but there might have been.
			</p>
			<p>
				<a href='/'>&gt; Go back home.</a>
			</p>
		</main>
	</Layout>
)
