import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { Entry } from '../model/entry.ts'
import { makeSlug } from '../common/slug.ts'
import { parseHashtags } from '../common/hashtag.ts'
import { createEntry, getEntryByURL } from '../db.ts'
import * as entry from './entry.ts'
import { clientRedirect } from '../common/util.ts'

export const get = (c: hono.Context<Env>) => {
  c.set('title', 'New entry')
  return c.var.render('entry-editor.vto', {
    entry: Entry.fromFormData(formDataFromObject(c.req.query())),
  })
}

const formDataFromObject = (obj: Record<string, string | string[]>) => {
  const formdata = new FormData()
  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      for (const v of value) formdata.append(key, v)
    } else {
      formdata.append(key, value)
    }
  }
  return formdata
}

export const getEdit = async (c: hono.Context<Env>) => {
  let entry
  try {
    const entryPath = c.req.query('entry')
    entry = await getEntryByURL(new URL(entryPath!, c.var.baseUrl))
  } catch {
    // invalid URL given
  }
  if (!entry) return c.notFound()
  c.set('title', 'Edit')
  return c.var.render('entry-editor.vto', { entry })
}

export const postEdit = (c: hono.Context<Env>) => {
  const entryPath = c.req.query('entry')
  if (!entryPath) return c.notFound()

  return entry.put(c, new URL(entryPath, c.var.baseUrl))
}

export const post = async (c: hono.Context<Env>) => {
  const formdata = await c.req.formData()

  const entry = await Entry.fromFormDataWithFiles(formdata, c.var.storage, c.var.baseUrl!)
  entry.uid = new URL(
    `${entry.published.getFullYear()}/${
      entry.name ? makeSlug(entry.name) : entry.published.toISOString()
    }`,
    c.var.baseUrl,
  )
  const { tags, html } = parseHashtags(entry.content!.html)
  entry.content!.html = html
  entry.category.push(...tags)
  await createEntry(entry)

  if (c.req.header('Soiree')) {
    return c.html(clientRedirect(entry.uid.pathname))
  } else {
    return c.redirect(entry.uid!.pathname, 303)
  }
}
