/** @jsx jsx */
/** @jsxFrag Fragment */

import { Card } from './model.ts'
import * as bcrypt from '../deps/bcrypt.ts'
import { createUser, getUser } from './db.ts'
import { Env } from './server.tsx'
import { Context, Hono, jsx } from '../deps/hono.ts'
import { Layout } from './ui.tsx'

// #region User model

export class User {
	constructor(
		public username: string,
		public pwhash: string,
		public profile: Card,
	) {}

	serialize() {
		return {
			...this,
			profile: this.profile.toMF2Json(),
		}
	}

	static deserialize(json: Record<string, unknown>) {
		return new User(
			String(json.username),
			String(json.pwhash),
			Card.fromMf2Json(json.profile),
		)
	}
}

// #endregion

// #region Password handling

const genSalt = bcrypt.genSalt
const hashPW = (pw: string, salt: string) => bcrypt.hash(pw, salt)
const checkPW = (pw: string, hash: string) => bcrypt.compare(pw, hash)

export const signup = async (username: string, pw: string, card: Card) => {
	const salt = await genSalt()
	const user = new User(username, await hashPW(pw, salt), card)
	await createUser(user)
}

export const login = async (
	username: string,
	pw: string,
): Promise<User | null> => {
	const user = await getUser(username)
	if (await checkPW(pw, user.pwhash)) return user
	else return null
}

// #endregion

// #region Web

export const app = new Hono<Env>()

export const currentUser = (c: Context<Env>) => {
	const username = c.get('session').get('user') as string
	if (!username) return null
	return getUser(username)
}

app.get('/login', (c) => c.html(<LoginForm />))

app.post('/login', async (c) => {
	const form = await c.req.formData()
	const username = form.get('username')
	const pw = form.get('pw')
	if (typeof username !== 'string' || typeof pw !== 'string') {
		return c.html(<LoginForm error='Missing username or password' />, 400)
	}
	const user = login(username, pw)
	if (!user) {
		return c.html(<LoginForm error='Incorrect username or password' />, 400)
	}

	// Login successful

	const sesh = c.get('session')
	sesh.set('user', username)
	return c.redirect('/')
})

app.post('/logout', (c) => {
	const sesh = c.get('session')
	sesh.deleteSession()
	return c.redirect('/')
})

// #endregion

// #region UI

export const LoginForm = (p: { error?: string }) => (
	<Layout title='Login -- Denizen'>
		<header>
			<h1>Log in</h1>
		</header>
		<main>
			{p.error && <div class='bad box'>{p.error}</div>}
			<form method='post' class='table rows'>
				{
					/* <p>
					<label for='edit-username'>Username</label>
					<input type='text' name='username' id='edit-username' />
				</p> */
				}
				<input type='hidden' name='username' value='admin' required />
				<p>
					<label for='edit-pw'>Password</label>
					<input type='password' name='pw' id='edit-pw' required />
				</p>
				<p>
					<template />
					<button type='submit'>Log in</button>
				</p>
			</form>
		</main>
	</Layout>
)

// #endregion
