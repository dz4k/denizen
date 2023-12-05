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
import { Post } from '../../model/post.ts'
import { PostEditor } from '../admin/posting.tsx'
import { Face, makeProfileSvg } from '../../widgets/face.tsx'

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

	c.header('Link', '</.denizen/webmention>; rel="webmention"')

	return c.html(
		<Layout
			title={post.name ?? post.summary ??
				post.published.toLocaleString()}
			lang={post.lang ?? config.lang()}
		>
			<article class='h-entry'>
				<header class='container padding-block-start'>
					<nav>
						<a href='/' class='p-author h-card author-card unlink'>
							<img
								src={siteOwner.profile.photo[0] ??
									makeProfileSvg(siteOwner.profile)}
								alt=''
								class='photo'
							/>
							<strong class='p-name'>
								{siteOwner.profile.name}
							</strong>
							<span>{config.baseUrl.hostname}</span>
						</a>
					</nav>
					{post.name ? <h1 class='p-name'>{post.name}</h1> : ''}
					{post.summary ? <p class='lede'>{post.summary}</p> : ''}
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
						dangerouslySetInnerHTML={{ __html: post.content?.html }}
					/>
				</main>
				<footer>
					<div class='<small>'>
						<p>
							<a href={post.uid} class='u-url u-uid'>
								<time class='dt-published'>
									{post.published.toLocaleString([
										...(post.lang ? [post.lang] : []),
										...config.locales,
									])}
								</time>
							</a>
							{post.updated
								? (
									<>
										, last updated on{' '}
										<time class='dt-updated'>
											{post.updated.toLocaleString([
												...(post.lang ? [post.lang] : []),
												...config.locales,
											])}
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

					{await Webmentions({ post })}
				</footer>
			</article>
		</Layout>,
	)
}

const Webmentions = async (props: { post: Post }) => {
	const { post } = props
	const [likes, reposts, mentions, replies] = await Promise.all([
		getWebmentions(post, 'like'),
		getWebmentions(post, 'repost'),
		getWebmentions(post, 'mention'),
		getWebmentions(post, 'reply'),
	])
	return (
		<div id='webmentions'>
			{likes.data.length
				? (
					<p>
						{/* TODO: "load more" buttons and total number on each */}
						<strong class='tiny-header'>Likes</strong>
						{likes.data.map((wm) => (
							<Face card={wm.content.author[0]} link={wm.source} />
						))}
					</p>
				)
				: ''}
			{reposts.data.length
				? (
					<p>
						<strong class='tiny-header'>Reposts</strong>
						{reposts.data.map((wm) => (
							<Face card={wm.content.author[0]} link={wm.source} />
						))}
					</p>
				)
				: ''}
			{mentions.data.length
				? (
					<p>
						<strong class='tiny-header'>Mentions</strong>
						{mentions.data.map((wm) => (
							<Face card={wm.content.author[0]} link={wm.source} />
						))}
					</p>
				)
				: ''}
			{replies.data.length
				? (
					<div>
						<p>
							<strong class='tiny-header'>Replies</strong>
						</p>
						{replies.data.map((wm) => (
							<article class='p-comment h-entry link-card'>
								{/* MAYBE TODO: replies with multiple authors? */}
								<header>
									<strong>
										<Face card={wm.content.author[0]} />
										<a
											class='p-author h-card'
											href={wm.content.author[0].url}
										>
											{wm.content.author[0].name}
										</a>
									</strong>{' '}
									<a class='u-url <small> card-link' href={wm.source}>
										<time
											class='dt-published'
											datetime={wm.content.published}
										>
											{wm.content.published.toLocaleString([
												...(post.lang ? [post.lang] : []),
												...config.locales,
											])}
										</time>
									</a>
								</header>
								{wm.content.name && (
									<strong>
										<cite class='p-name'>{wm.content.name}</cite>
										{' '}
									</strong>
								)}
								<span class='p-content'>
									{wm.content.content?.value}
								</span>
								{' '}
							</article>
						))}
					</div>
				)
				: ''}
		</div>
	)
}

export const put = async (
	c: hono.Context<Env>,
	url = new URL(c.req.url),
) => {
	const oldPost = await getPostByURL(url)
	if (!oldPost) return c.notFound()

	const formdata = await c.req.formData()

	const newPost = Post.fromFormData(formdata)
	newPost.iid = oldPost.iid
	newPost.uid = oldPost.uid
	await updatePost(newPost)

	if (c.req.header('HX-Request')) {
		return c.body(null, 204, {
			'HX-Redirect': newPost.uid!.pathname,
		})
	} else {
		return c.body(null, 303, {
			'Location': newPost.uid!.pathname,
		})
	}
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
