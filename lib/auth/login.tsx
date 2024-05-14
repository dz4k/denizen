/** @jsx hono.jsx */
/** @jsxFrag hono.Fragment */

import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import * as bcrypt from '../../deps/bcrypt.ts'

import { getConfig, getUser } from '../db.ts'
import { User } from '../model/user.ts'
import { LoginForm } from './_login-form.tsx'

export const login = async (
	username: string,
	pw: string,
): Promise<User | null> => {
	const user = await getUser(username)
	if (await bcrypt.compareSync(pw, user.pwhash)) return user
	else return null
}

export const get = (c: hono.Context<Env>) =>
	c.html(<LoginForm theme={c.var.theme} />)

export const post = async (c: hono.Context<Env>) => {
	const form = await c.req.formData()
	const username = form.get('username')
	const pw = form.get('pw')
	if (typeof username !== 'string' || typeof pw !== 'string') {
		return c.html(
			<LoginForm theme={c.var.theme} error='Missing username or password' />,
			400,
		)
	}
	const user = login(username, pw)
	if (!user) {
		return c.html(
			<LoginForm theme={c.var.theme} error='Incorrect username or password' />,
			400,
		)
	}

	// Login successful

	const sesh = c.get('session')
	sesh.set('user', username)
	return c.redirect('/')
}

export const logout = (c: hono.Context<Env>) => {
	const sesh = c.get('session')
	sesh.deleteSession()
	return c.redirect('/')
}
