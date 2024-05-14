import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'
import { Layout } from '../layout.ts'

import * as config from '../config.ts'
import {
	deletePost,
	getPostByURL,
	getUser,
	getWebmentions,
	updatePost,
} from '../db.ts'
import { isAdmin } from '../admin/middleware.ts'
import { Entry } from '../model/entry.ts'
import { Face, makeProfileSvg } from '../widgets/face.tsx'
import { clientRedirect } from '../common/util.ts'

const accessPost = (c: hono.Context<Env>) =>
	getPostByURL(new URL(c.req.path, config.baseUrl))

export const get = async (c: hono.Context<Env>) => {
	const post = await accessPost(c)
	if (post === null) return c.notFound()

	if (/application\/(mf2\+)json/i.test(c.req.header('Expect')!)) {
		if (post.deleted) return c.json({ deleted: true }, 410)
		return c.json(post.toMF2Json())
	}

	if (post.deleted) return c.render(<PostDeleted theme={c.var.theme} />)
	const admin = isAdmin(c)
	const siteOwner = await getUser('admin')

	c.header('Link', '</.denizen/webmention>; rel="webmention"')
	c.header('Last-Modified', (post.updated ?? post.published).toUTCString())

	c.set('title', post.name ?? post.summary ?? post.published.toLocaleString())
	c.set('lang', post.lang ?? config.lang())

	return c.render(
		<>
			<meta property='og:url' content={post.uid!.href} />
			<meta property='og:site_name' content={siteOwner.profile.name} />
			{post.name ? <meta property='og:title' content={post.name} /> : ''}
			{post.summary
				? (
					<meta
						name='description'
						property='og:description'
						content={post.summary}
					/>
				)
				: ''}
			{post.photo.map((photo) => (
				<>
					<meta property='og:image' content={photo.url.href} />
					<meta property='og:image:alt' content={photo.alt} />
				</>
			))}
			{post.video.map((video) => (
				<>
					<meta property='og:video' content={video.href} />
				</>
			))}
			{post.audio.map((audio) => (
				<>
					<meta property='og:audio' content={audio.href} />
				</>
			))}
			<article class='h-entry'>
				<header class='container padding-block-start'>
					<nav>
						<a href='/' class='p-author h-card author-card unlink'>
							<img
								src={siteOwner.profile.photo[0]?.url.href ??
									makeProfileSvg(siteOwner.profile)}
								alt={siteOwner.profile.photo[0]?.alt}
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
					{console.log(post.inReplyTo)}
					{post.inReplyTo.map((cite) => (
						// TODO: better reply context
						<p class='reply-context p-in-reply-to h-cite'>
							<strong class='tiny-header'>↪ In reply to</strong>
							{cite.author?.map((author) => (
								<>
									<a
										class='p-author h-card'
										href={author.url[0].href}
									>
										{author.name}
									</a>
									,{' '}
								</>
							))}
							<a
								href={(cite.uid ?? cite.url[0]).href}
								class={cite.uid ? 'u-uid' : ''}
							>
								{cite.name
									? <cite class='p-name'>{cite.name}</cite>
									: cite.content
									? <span class='p-content'>{cite.content.slice(0, 40)}</span>
									: <span>{(cite.uid ?? cite.url[0]).href}</span>}
							</a>
						</p>
					))}
					{post.bookmarkOf.map((cite) => (
						<p class='repost-context p-repost-of h-cite'>
							<strong class='tiny-header'>🔁 Reposted from</strong>
							{cite.author?.map((author) => (
								<>
									<a
										class='p-author h-card'
										href={author.url[0].href}
									>
										{author.name}
									</a>
									,{' '}
								</>
							))}
						</p>
					))}
					{post.photo.map((photo) => (
						<figure>
							<img class='u-photo' src={photo.url.href} alt={photo.alt} />
						</figure>
					))}
					<div
						class='e-content'
						dangerouslySetInnerHTML={{ __html: post.content?.html! }}
					/>
				</main>
				<footer>
					<div class='<small>'>
						<p>
							<a href={post.uid!.href} class='u-url u-uid'>
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

					<div style='display: flex; flex-flow: row wrap; gap: 1em'>
						<denizen-webaction action='reply'>
							<button>Reply</button>
						</denizen-webaction>
						{admin
							? (
								<>
									<form action='/.denizen/post/edit' class='contents'>
										<input
											type='hidden'
											name='post'
											value={post.uid?.pathname}
										/>
										<button>Edit</button>
									</form>
									<form
										rel='swap-after'
										method='DELETE'
										action={post.uid!.pathname}
										class='contents'
									>
										<button>Delete</button>
									</form>
								</>
							)
							: ''}
					</div>

					{await Webmentions({ post })}
				</footer>
			</article>
		</>,
	)
}

const Webmentions = async (props: { post: Entry }) => {
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
											href={wm.content.author[0].url[0].href}
										>
											{wm.content.author[0].name}
										</a>
									</strong>{' '}
									<a class='u-url <small> card-link' href={wm.source}>
										<time
											class='dt-published'
											datetime={wm.content.published.toISOString()}
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

	const newPost = Entry.fromFormData(formdata)
	newPost.iid = oldPost.iid
	newPost.uid = oldPost.uid
	await updatePost(newPost)

	if (c.req.header('Soiree')) {
		return c.html(
			hono.html`<script>location='${newPost.uid!.pathname}'</script>`,
		)
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
	if (c.req.header('Soiree')) {
		return c.html(clientRedirect('/'))
	}
	return c.redirect('/', 303)
}

const PostDeleted = () => {
	const c = hono.useRequestContext()
	c.status(410)
	c.set('title', 'Deleted post')
	return (
		<main>
			<h1>HTTP 410</h1>
			<p>
				There's nothing here... but there might have been.
			</p>
			<p>
				<a href='/'>&gt; Go back home.</a>
			</p>
		</main>
	)
}
