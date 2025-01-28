import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import {
  deleteEntry,
  getEntryByURL,
  getUser,
  getWebmentions,
  updateEntry,
} from '../db.ts'
import { isAdmin } from '../admin/middleware.ts'
import { Entry } from '../model/entry.ts'
import { clientRedirect } from '../common/util.ts'

const accessEntry = (c: hono.Context<Env>) =>
  getEntryByURL(new URL(c.req.path, c.var.baseUrl))

export const get = async (c: hono.Context<Env>) => {
  const entry = await accessEntry(c)
  if (entry === null) return c.notFound()

  c.header('Vary', 'Accept')
  c.header('Vary', 'Cookie')

  if (/application\/(mf2\+)json/i.test(c.req.header('Accept')!)) {
    if (entry.deleted) return c.json({ deleted: true }, 410)
    return c.json(entry.toMF2Json())
  }

  if (entry.deleted) {
    c.status(410)
    c.set('title', 'Deleted entry')
    return c.var.render('410.vto')
  }

  const admin = isAdmin(c)
  const siteOwner = await getUser('admin')

  c.header('Link', '</.denizen/webmention>; rel="webmention"')
  c.header('Last-Modified', (entry.updated ?? entry.published).toUTCString())

  c.set('title', entry.name ?? entry.summary ?? entry.published.toLocaleString())
  c.set('lang', entry.language ?? c.var.lang)

  const [likes, reposts, mentions, replies] = await Promise.all([
    getWebmentions(entry, 'like'),
    getWebmentions(entry, 'repost'),
    getWebmentions(entry, 'mention'),
    getWebmentions(entry, 'reply'),
  ])

  return c.var.render('entry.vto', {
    entry,
    admin,
    siteOwner,
    webmentions: { likes, reposts, mentions, replies },
  })
}

export const put = async (
  c: hono.Context<Env>,
  url = new URL(c.req.url),
) => {
  const oldEntry = await getEntryByURL(url)
  if (!oldEntry) return c.notFound()

  const formdata = await c.req.formData()

  const newEntry = await Entry.fromFormDataWithFiles(
    formdata,
    c.var.storage,
    c.var.baseUrl!,
  )
  newEntry.iid = oldEntry.iid
  newEntry.uid = oldEntry.uid
  await updateEntry(newEntry)

  if (c.req.header('Soiree')) {
    return c.html(
      hono.html`<script>location='${newEntry.uid!.pathname}'</script>`,
    )
  } else {
    return c.body(null, 303, {
      'Location': newEntry.uid!.pathname,
    })
  }
}

export const del = async (c: hono.Context<Env>) => {
  const entry = await accessEntry(c)
  if (entry === null) return c.notFound()
  await deleteEntry(entry)
  if (c.req.header('Soiree')) {
    return c.html(clientRedirect('/'))
  }
  return c.redirect('/', 303)
}
