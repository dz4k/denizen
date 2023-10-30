import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'

import { stringify } from '../../../deps/xml.ts'

import { getPosts, getUser, lastMod } from '../../db.ts'
import * as config from '../../config.ts'

export const json = async (c: hono.Context<Env>) => {
	const lastModified = await lastMod()
	const ifModSince = c.req.header('If-Modified-Since')
	if (ifModSince) {
		const ifModSinceDate = new Date(ifModSince).getTime()
		if (lastModified < ifModSinceDate) return c.body('', 304)
	}

	const siteOwner = await getUser('admin')
	const posts = await getPosts({
		limit: 20,
		cursor: c.req.query('cursor'),
	})
	return c.json(
		{
			version: 'https://jsonfeed.org/version/1.1',
			title: siteOwner.profile.name,
			home_page_url: config.baseUrl,
			feed_url: new URL('/feed.json', config.baseUrl).href,
			description: siteOwner.profile.note[0],
			user_comment: 'Generated by Denizen <https://codeberg.org/dz4k/denizen>',
			next_url: posts.cursor
				? new URL(
					`/feed.json?cursor=${encodeURIComponent(posts.cursor)}`,
					config.baseUrl,
				).href
				: undefined,
			authors: [{
				name: siteOwner.profile.name,
				url: config.baseUrl,
			}],
			language: config.locales[0],
			items: posts.data.map((post) => ({
				id: post.uid,
				url: post.uid,
				title: post.name,
				content_html: post.content?.html,
				summary: post.summary,
				image: post.photo[0],
				date_published: post.published.toISOString(),
				date_modified: post.updated?.toISOString(),
				tags: post.category,
			})),
		},
		200,
		{
			'Content-Type': 'application/feed+json',
			'Last-Modified': new Date(lastModified).toString(),
		},
	)
}

export const xml = async (c: hono.Context<Env>) => {
	const lastModified = await lastMod()
	const ifModSince = c.req.header('If-Modified-Since')
	if (ifModSince) {
		const ifModSinceDate = new Date(ifModSince).getTime()
		if (lastModified < ifModSinceDate) return c.body('', 304)
	}

	const siteOwner = await getUser('admin')
	const posts = await getPosts({
		limit: 20,
		cursor: c.req.query('cursor'),
	})
	return c.body(
		stringify({
			feed: {
				'@xmlns': 'http://www.w3.org/2005/Atom',
				title: siteOwner.profile.name,
				link: { '@href': config.baseUrl.href },
				updated: new Date(lastModified).toISOString(),
				generator: {
					'@uri': 'https://codeberg.org/dz4k/denizen',
					'#text': 'Denizen',
				},
				entry: posts.data.map((post) => ({
					id: post.uid,
					title: post.name,
					updated: post.updated ?? post.published,
					content: {
						'@type': 'html',
						'#text': post.content.html,
					},
					summary: post.summary,
					published: post.published,
					category: post.category.map((cat) => ({ '@term': cat })),
				})),
			},
		}),
		200,
		{
			'Content-Type': 'application/atom+xml',
		},
	)
}
