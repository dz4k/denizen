/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import * as config from '../../config.ts'
import {
	deletePost,
	getPostByURL,
	getUser,
	getWebmentionCount,
	getWebmentions,
	updatePost,
} from '../../db.ts'
import { isAdmin } from '../admin/middleware.ts'
import { Post } from '../../model.ts'
import { PostEditor } from '../admin/posting.tsx'
import { Face } from '../../widgets/face.tsx'

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
	const siteOwner = await getUser('admin')

	c.header('Link', '</.denizen/webmention>;rel="webmention"')

	return c.html(
		<Layout
			title={post.name ?? post.summary ??
				post.published.toLocaleTimeString()}
		>
			<article class='h-entry'>
				<header class='container padding-block-start'>
					<nav>
						<a href='/' class='p-author h-card author-card unlink'>
							<img src='/.denizen/public/profile.svg' alt='' class='photo' />
							<strong class='p-name'>
								{siteOwner.profile.name},
								<Face card={siteOwner.profile} />
							</strong>
							<span>{config.baseUrl.hostname}</span>
						</a>
					</nav>
					{post.name ? <h1 class='p-name'>{post.name}</h1> : ''}
					{post.summary
						? (
							<p
								class='lede'
								dangerouslySetInnerHTML={{ __html: post.summary }}
							/>
						)
						: ''}
				</header>
				<main>
					{post.photo.map((photo) => (
						<figure>
							{/* TODO alt text for u-photo */}
							<img class='u-photo' src={photo} alt='' />
						</figure>
					))}
					<div
						class='e-content'
						dangerouslySetInnerHTML={{ __html: post.content }}
					/>
				</main>
				<footer>
					<div class='<small>'>
						<p>
							<a href={post.uid} class='u-url u-uid'>
								<time class='dt-published'>
									{post.published.toLocaleString(config.locales)}
								</time>
							</a>
							{post.updated
								? (
									<>
										, last updated on{' '}
										<time class='dt-updated'>
											{post.updated.toLocaleString(config.locales)}
										</time>
									</>
								)
								: ''}
						</p>
						<p>
							{post.category.map((cat) => (
								<>
									#<span class='p-category'>{cat}</span>
									{' '}
								</>
							))}
						</p>
					</div>

					<div id='webmentions'>
						<p>
							<strong>Likes:</strong>
							{(await getWebmentions(post, 'like')).data.map((wm) => (
								<Face card={wm.content.author[0]} link={wm.source} />
							))}
						</p>
						<p>
							<strong>Reposts:</strong>
							{(await getWebmentions(post, 'repost')).data.map((wm) => (
								<Face card={wm.content.author[0]} link={wm.source} />
							))}
						</p>
						<p>
							<strong>Mentions:</strong>
							{(await getWebmentions(post, 'mention')).data.map((wm) => (
								<Face card={wm.content.author[0]} link={wm.source} />
							))}
						</p>
						<p>
							<strong>Replies:</strong>
							{(await getWebmentions(post, 'reply')).data.map((wm) => (
								<Face card={wm.content.author[0]} link={wm.source} />
							))}
						</p>
					</div>

					{admin
						? (
							<div style='display: flex; flex-flow: row wrap; gap: 1em'>
								<form action='/.denizen/post/edit' class='contents'>
									<input type='hidden' name='post' value={post.uid?.pathname} />
									<button>Edit</button>
								</form>
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

export const put = async (c: hono.Context<Env>) => {
	const oldPost = await getPostByURL(new URL(c.req.url))
	if (!oldPost) return c.notFound()

	const formdata = await c.req.formData()

	const newPost = Post.fromFormData(formdata)
	newPost.iid = oldPost.iid
	newPost.uid = oldPost.uid
	await updatePost(newPost)

	c.header('HX-Redirect', newPost.uid?.pathname)
	c.status(204)
	return c.res
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
