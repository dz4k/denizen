import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import * as bcrypt from '../../deps/bcrypt.ts'

import { getUser } from '../db.ts'
import { User } from '../model/user.ts'

export const login = async (
  username: string,
  pw: string,
): Promise<User | null> => {
  const user = await getUser(username)
  if (bcrypt.verify(pw, user.pwhash, {})) return user
  else return null
}

export const get = (c: hono.Context<Env>) => {
  c.set('title', 'Log in to Denizen')
  return c.var.render('login.vto')
}

export const post = async (c: hono.Context<Env>) => {
  c.set('title', 'Log in to Denizen')

  const form = await c.req.formData()
  const username = form.get('username')
  const pw = form.get('pw')
  if (typeof username !== 'string' || typeof pw !== 'string') {
    c.status(400)
    return c.var.render('login.vto', { error: 'Missing username or password' })
  }
  const user = login(username, pw)
  if (!user) {
    c.status(400)
    return c.var.render('login.vto', {
      error: 'Incorrect username or password',
    })
  }

  // Login successful

  const sesh = c.get('session')
  sesh.set('user', username)
  return c.redirect('/')
}

export const logout = (c: hono.Context<Env>) => {
  const sesh = c.get('session')
  sesh.delete()
  return c.redirect('/')
}
