/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import { db } from '../../db.ts'

export const get = (c: hono.Context<Env>) => {
	return c.html(<ImportForm />)
}

export const post = async (c: hono.Context<Env>) => {
	const body = await c.req.parseBody()
	if (typeof body['feed-url'] !== 'string') {
		return c.html(<ImportForm error='Please specify an URL' />, 400)
	}
	let feedUrl
	try {
		feedUrl = new URL(body['feed-url'])
	} catch {
		return c.html(<ImportForm error='Invalid feed URL' />, 400)
	}
	// await enqueue({
	// 	type: 'import_blog',
	// 	feedUrl: feedUrl.href,
	// })
	return c.html(
		<ImportForm error='Blog importing is not yet implemented' />,
		400,
	)
}

export const ImportForm = (p: { error?: string }) => (
	<section>
		<h1>Import blog to Denizen</h1>
		<main>
			<form
				hx-post='/.denizen/import-blog'
				hx-target='closest section'
				hx-swap='outerHTML'
				class='grid'
				style='grid: auto-flow / auto 1fr'
			>
				{p.error
					? (
						<div class='bad' style='grid-column: 1/span 2'>
							<p>{p.error}</p>
						</div>
					)
					: ''}
				<p class='grid-row'>
					<label for='feed-url'>Feed URL</label>
					<span class='grid'>
						<input
							type='url'
							name='feed-url'
							id='feed-url'
							aria-describedby='feed-url-desc'
						/>
						<span id='feed-url-desc' class='<small>'>
							Enter a RSS, Atom or JSONFeed URL for your old blog.
						</span>
					</span>
				</p>
				<p class='grid-row'>
					<span />
					<span>
						<button class='big'>Import</button>
					</span>
				</p>
			</form>
			<p>
				Denizen can import your posts from an old blog using an RSS, Atom or
				JSONFeed feed.
			</p>
		</main>
	</section>
)
