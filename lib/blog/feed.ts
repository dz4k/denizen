import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { getEntries, getUser, lastMod } from '../db.ts'
import render from '../common/vento.ts'

export const json = async (c: hono.Context<Env>) => {
  const lastModified = await lastMod()
  const ifModSince = c.req.header('If-Modified-Since')
  if (ifModSince) {
    const ifModSinceDate = new Date(ifModSince).getTime()
    if (lastModified < ifModSinceDate) return c.body(null, 304)
  }

  const siteOwner = await getUser('admin')
  const entries = await getEntries({
    limit: 20,
    cursor: c.req.query('cursor'),
  })
  return c.json(
    {
      version: 'https://jsonfeed.org/version/1.1',
      title: siteOwner.profile.name,
      home_page_url: c.var.baseUrl,
      feed_url: new URL('/feed.json', c.var.baseUrl).href,
      description: siteOwner.profile.note[0],
      user_comment: 'Generated by Denizen <https://codeberg.org/dz4k/denizen>',
      next_url: entries.cursor
        ? new URL(
          `/feed.json?cursor=${encodeURIComponent(entries.cursor)}`,
          c.var.baseUrl,
        ).href
        : undefined,
      authors: [{
        name: siteOwner.profile.name,
        url: c.var.baseUrl,
      }],
      language: c.var.lang,
      items: entries.data.map((entry) => ({
        id: entry.uid,
        url: entry.uid,
        title: entry.name,
        content_html: entry.content?.html,
        summary: entry.summary,
        image: entry.photo[0],
        date_published: entry.published.toISOString(),
        date_modified: entry.updated?.toISOString(),
        tags: entry.category,
      })),
    },
    200,
    {
      'Content-Type': 'application/feed+json',
      'Last-Modified': new Date(lastModified).toUTCString(),
    },
  )
}

export const xml = async (c: hono.Context<Env>) => {
  const lastModified = await lastMod()
  const ifModSince = c.req.header('If-Modified-Since')
  if (ifModSince) {
    const ifModSinceDate = new Date(ifModSince).getTime()
    if (lastModified < ifModSinceDate) return c.body(null, 304)
  }

  const siteOwner = await getUser('admin')
  const entries = await getEntries({
    limit: 20,
    cursor: c.req.query('cursor'),
  })
  return c.body(
    await render(c, 'atom.vto', { siteOwner, entries, lastModified }),
    200,
    {
      'Content-Type': 'application/atom+xml',
    },
  )
}
