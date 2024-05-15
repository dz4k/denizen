import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import * as config from '../config.ts'
import { getPosts, getUser } from '../db.ts'
import { isAdmin } from '../admin/middleware.ts'
import { makeProfileSvg } from '../widgets/face.tsx'

export const get = async (c: hono.Context<Env>) => {
	const requestedLanguages = c.req.queries('lang') ??
		c.req.header('Accept-Language')
			?.split(',')
			.map((tag) => {
				const [lang, q] = tag.split(';q=')
				return { lang, q: q ? parseFloat(q) : 1 }
			})
			.sort((a, b) => b.q - a.q)
			.map(({ lang }) => lang) ??
		[]
	const lang =
		requestedLanguages.find((lang) => config.locales.includes(lang)) ??
			config.lang()

	c.set('lang', lang)

	const { cursor } = c.req.query()
	const siteOwner = await getUser('admin')
	const posts = await getPosts({ cursor })
	const admin = isAdmin(c)

	const socials = Object.entries(siteOwner.profile.me)
	const badges = siteOwner.profile.denizenBadge

	c.set('title', siteOwner.profile.name)
	c.set('theme', c.var.theme)

	return c.render(
		<>
			<header class='h-card' lang={config.lang()}>
				{/* TODO: used this makeprofilesvg in a few places now, factor out to Card. */}
				<img
					src={siteOwner.profile.photo[0]?.url.href ??
						makeProfileSvg(siteOwner.profile)}
					alt={siteOwner.profile.photo[0]?.alt}
					class='big face'
				/>
				<h1>
					<a href='/' class='u-url u-uid p-name'>
						{siteOwner.profile.name}
					</a>
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
										class={`<button> ${
											value.startsWith('mailto') ? 'u-email' : ''
										}`}
										href={value}
									>
										{name}
									</a>&emsp;
								</>
							))}
						</p>
					)
					: ''}
				{badges.length
					? (
						<p class='denizen-badges'>
							{badges.map((badge) => {
								const img = (
									<img
										src={badge.photo?.url.href}
										alt={badge.photo?.alt}
										class='badge'
									/>
								)
								return (
									<span className='p-x-denizen-badge h-x-denizen-badge'>
										{badge.url
											? (
												<a href={badge.url.href} class='u-url'>
													{img}
												</a>
											)
											: img}
									</span>
								)
							})}
						</p>
					)
					: ''}
			</header>
			<main>
				{admin
					? (
						<form
							class='quick-post'
							method='POST'
							action='/.denizen/post/new'
						>
							<textarea
								name='content'
								class='quick-post-content'
								aria-label='What&apos;s on your mind?'
								placeholder='What&apos;s on your mind?'
							>
							</textarea>
							<div class='quick-post-form-actions'>
								<a class='<small>' href='/.denizen/post/new'>Open big editor</a>
								<button type='submit' class='quick-post-submit'>Post</button>
							</div>
						</form>
					)
					: ''}
				<div className='entry-list'>
					{posts.data.map((post) => (
						<article
							class='h-entry link-card'
							lang={post.lang ?? config.lang()}
						>
							<h2>
								<a class='p-name u-url u-uid' href={post.uid!.pathname}>
									{post.name}
								</a>
							</h2>
							{post.photo.map((photo) => (
								<figure>
									<img class='u-photo' src={photo.url.href} alt={photo.alt} />
								</figure>
							))}
							{post.summary
								? (
									<p
										class='italic'
										dangerouslySetInnerHTML={{ __html: post.summary }}
									/>
								)
								: post.name
								? ''
								: post.content && (
									<div
										class='e-content'
										dangerouslySetInnerHTML={{ __html: post.content.html }}
									/>
								)}
							<p class='<small>'>
								<a href={post.uid?.pathname} class='card-link'>
									<time className='dt-published'>
										{post.published.toLocaleString([
											...(post.lang ? [post.lang] : []),
											lang,
										])}
									</time>
								</a>
								{post.updated && (
									<>
										{' '}&middot; Updated on{' '}
										<time className='dt-updated'>
											{post.updated.toLocaleString([
												...(post.lang ? [post.lang] : []),
												lang,
											])}
										</time>
									</>
								)}
							</p>
						</article>
					))}
				</div>
				{posts.cursor
					? (
						<a
							rel='next swap-replaceWith'
							href={'/?cursor=' + encodeURIComponent(posts.cursor) +
								'#:~:selector=main :is(.h-entry, [rel=next])'}
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
							<a class='<button>' href='/.denizen/console'>Console</a>
							<form method='POST' action='/.denizen/logout' class='contents'>
								<button>Log out</button>
							</form>
						</div>
					)
					: ''}
			</footer>
			{admin
				? (
					<script
						dangerouslySetInnerHTML={{
							__html: `
						navigator.registerProtocolHandler(
							'web+action',
							${
								JSON.stringify(
									new URL('/.denizen/webaction?handler=%s', config.baseUrl)
										.href,
								)
							},
							'Denizen on ' + location.hostname
						)
					`,
						}}
					/>
				)
				: ''}
		</>,
	)
}
