/** @jsx jsx */
/** @jsxFrag Fragment */

import { decodeBase64 } from 'https://deno.land/std@0.203.0/encoding/base64.ts'
import { contentType } from 'https://deno.land/std@0.203.0/media_types/content_type.ts'
import * as path from 'https://deno.land/std@0.203.0/path/mod.ts'

import { Context, Fragment, Hono, jsx } from '../deps/hono.ts'
import {
	DenoKvStore,
	Session,
	sessionMiddleware,
} from '../deps/hono_sessions.ts'

import { Layout } from './ui.tsx'
import {
	db,
	deletePost,
	getPostByURL,
	getPosts,
	getUser,
	initialSetupDone,
} from './db.ts'
import { installAuth } from './auth.tsx'
import installAdmin, { isAdmin, requireAdmin } from './admin.tsx'
import installStorage from './storage.tsx'
import * as config from './config.ts'
import installFeeds from './feed.ts'

import assets from '../build/assets.json' assert { type: 'json' }

export type Env = {
	Variables: {
		session: Session
		session_key_rotation: boolean
		authScopes: string[]
	}
}

export const app = new Hono<Env>()

app.use(
	'*',
	sessionMiddleware({
		store: new DenoKvStore(db, 'Sessions'),
		expireAfterSeconds: 60 * 60 * 24 * 7, // 1 week
		cookieOptions: { sameSite: 'Lax' },
	}),
)

// Do not serve any pages until initial setup is done
app.use(async (c, next) => {
	if (
		c.req.path !== '/.denizen/initial-setup' &&
		!c.req.path.startsWith('/.denizen/public/') && !await initialSetupDone()
	) {
		return c.redirect('/.denizen/initial-setup', 303)
	} else await next()
})

installFeeds(app)

const internals = app.basePath('/.denizen')
installAuth(internals)
installAdmin(internals)
installStorage(internals)

// Public Denizen assets
for (const [name, data] of Object.entries(assets)) {
	console.log(name)
	internals.get(`/public/${name}`, (c) => {
		c.header('Content-Type', contentType(path.extname(name)))
		return c.body(decodeBase64(data))
	})
}

app.get('/', async (c) => {
	const { cursor } = c.req.query()
	const siteOwner = await getUser('admin')
	const posts = await getPosts({ cursor })
	const admin = isAdmin(c)

	const socials = Object.entries(siteOwner.profile.me)
	return c.html(
		<Layout title={siteOwner.profile.name}>
			<header class='h-card'>
				<h1>
					<a href='/' class='u-url u-uid p-name'>{siteOwner.profile.name}</a>
				</h1>
				{siteOwner.profile.note.length
					? <p class='p-note'>{siteOwner.profile.note}</p>
					: ''}
				{socials.length
					? (
						<p>
							{socials.map(([name, value]) => (
								<>
									<a
										rel='me'
										{...(value.startsWith('mailto')
											? { class: 'u-email' }
											: {})}
										href={value}
									>
										{name}
									</a>&emsp;
								</>
							))}
						</p>
					)
					: ''}
			</header>
			<main>
				{posts.data.map((post) => (
					<article class='h-entry margin-block padding-block'>
						<h2>
							<a class='p-name u-url u-uid' href={post.uid!.pathname}>
								{post.name}
							</a>
						</h2>
						<p>
							<time className='dt-published'>
								{post.published.toLocaleString(config.locales)}
							</time>
							{post.updated && (
								<>
									{' '}&middot; Updated on{' '}
									<time className='dt-updated'>
										{post.updated.toLocaleString(config.locales)}
									</time>
								</>
							)}
						</p>
						{post.summary
							? (
								<p
									class='italic'
									dangerouslySetInnerHTML={{ __html: post.summary }}
								/>
							)
							: ''}
					</article>
				))}
				{posts.cursor
					? (
						<a
							rel='next'
							href={'/?cursor=' + encodeURIComponent(posts.cursor)}
							hx-boost
							hx-select='main :is(.h-entry, [rel=next])'
						>
							Load more
						</a>
					)
					: ''}
			</main>
			<footer>
				{admin
					? (
						<div style='display: flex; flex-flow: row wrap; gap: 1em'>
							<a class='<button>' href='/.denizen/post/new'>+ New Post</a>
							<a class='<button>' href='/.denizen/console'>Console</a>
							<form method='POST' action='/.denizen/logout' class='contents'>
								<button>Logout</button>
							</form>
						</div>
					)
					: ''}
			</footer>
		</Layout>,
	)
})

app.get(
	'/wp-admin/',
	(c) => c.redirect('https://youtube.com/watch?v=dQw4w9WgXcQ'),
)

const accessPost = (c: Context<Env>) =>
	getPostByURL(new URL(c.req.path, config.baseUrl))

app.get('*', async (c) => {
	const post = await accessPost(c)
	if (post === null) return c.notFound()
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
})

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

app.delete('*', requireAdmin, async (c) => {
	const post = await accessPost(c)
	if (post === null) return c.notFound()
	await deletePost(post)
	if (c.req.header('HX-Request')) {
		c.header('HX-Redirect', '/')
		return c.body('')
	}
	return c.redirect('/', 303)
})

app.notFound((c) =>
	c.html(
		<Layout title='="Not found'>
			<main>
				<h1>Page not found</h1>
				<p>HTTP 404</p>
			</main>
		</Layout>,
	)
)
