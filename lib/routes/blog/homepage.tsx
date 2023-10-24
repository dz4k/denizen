/** @jsx hono.h */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import * as config from '../../config.ts'
import { getPosts, getUser } from '../../db.ts'
import { isAdmin } from '../admin/middleware.ts'

export const get = async (c: hono.Context<Env>) => {
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
						<p class='<small>'>
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
							: post.name
							? ''
							: (
								<div
									class='e-content'
									dangerouslySetInnerHTML={{ __html: post.content }}
								/>
							)}
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
}
