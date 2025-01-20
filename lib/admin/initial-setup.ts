import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import * as bcrypt from '../../deps/bcrypt.ts'

import {
  completeInitialSetup,
  createUser,
  initialSetupDone,
  setConfig,
} from '../db.ts'
import { User } from '../model/user.ts'
import { Card } from '../model/card.ts'
import { isValidUrl } from '../common/util.ts'

const signup = async (username: string, pw: string, card: Card) => {
  const user = new User(username, bcrypt.hash(pw, {}), card)
  await createUser(user)
}

export const middleware: hono.MiddlewareHandler<Env> = async (c, next) => {
  if (
    c.req.path !== '/.denizen/initial-setup' &&
    !c.req.path.startsWith('/.denizen/public/') && !await initialSetupDone()
  ) {
    return c.redirect('/.denizen/initial-setup', 303)
  } else await next()
}

export const get = (c: hono.Context<Env>) => {
  c.set('title', 'Initial Setup -- Denizen')
  return c.var.render('initial-setup.vto')
}

export const post = async (c: hono.Context<Env>) => {
  if (await initialSetupDone()) return c.status(403)

  // Create admin account
  const form = await c.req.formData()
  const pw = form.get('pw')
  if (typeof pw !== 'string') {
    c.status(400)
    return c.var.render('initial-setup.vto', {
      error: 'Missing username or password',
    })
  }

  const displayName = form.get('name')
  if (typeof displayName !== 'string') {
    c.status(400)
    return c.var.render('initial-setup.vto', { error: 'Please enter a name' })
  }

  const siteUrl = form.get('site-url')
  if (
    typeof siteUrl !== 'string' ||
    !isValidUrl(siteUrl)
  ) {
    c.status(400)
    return c.var.render('initial-setup.vto', {
      error: 'Site URL should be a valid URL',
    })
  }

  const locale = form.get('lang')
  if (typeof locale !== 'string') {
    c.status(400)
    return c.var.render('initial-setup.vto', {
      error: 'Please choose a language for your blog',
    })
  }

  // Do setup
  await signup('admin', pw, new Card(displayName))
  await setConfig('base url', siteUrl)
  await setConfig('locales', [locale])

  // Mark setup as completed
  await completeInitialSetup()

  // Sign in to admin account
  const sesh = c.get('session')
  sesh.set('user', 'admin')
  return c.redirect('/', 303)
}
