import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { getEntries, getUser } from '../db.ts'
import { isAdmin } from '../admin/middleware.ts'

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
    requestedLanguages.find((lang) => c.var.locales.includes(lang)) ??
      c.var.lang

  c.set('lang', lang)

  const { cursor } = c.req.query()
  const siteOwner = await getUser('admin')
  const entries = await getEntries({ cursor })
  entries.data = entries.data.filter((entry) => !entry.hidden)
  const admin = isAdmin(c)

  const socials = Object.entries(siteOwner.profile.me)
  const badges = siteOwner.profile.denizenBadge

  c.set('title', siteOwner.profile.name)
  c.set('theme', c.var.theme)

  return c.var.render('index.vto', { admin, siteOwner, entries, socials, badges })
}
