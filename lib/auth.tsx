/** @jsx jsx */
/** @jsxFrag Fragment */

import { Card } from './model.ts'
import * as bcrypt from '../deps/bcrypt.ts'
import { createUser, getUser } from './db.ts'
import type { Env } from './server.tsx'
import { type Hono, jsx } from '../deps/hono.ts'
import { Layout } from './ui.tsx'
import * as config from './config.ts'

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

const genSalt = bcrypt.genSaltSync
const hashPW = (pw: string, salt: string) => bcrypt.hashSync(pw, salt)
const checkPW = (pw: string, hash: string) => bcrypt.compareSync(pw, hash)

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

// #region Web login & signup

export function installAuth(app: Hono<Env>) {
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

	app.get('/indieauth-cb', async (c) => {
		const validate = await fetch('https://indieauth.com/auth', {
			method: 'POST',
			body: new URLSearchParams({
				code: c.req.query('code')!,
				redirect_uri: new URL('/.denizen/indieauth-cb', config.baseUrl).href,
				client_id: config.baseUrl.href,
			}),
		}).then((res) => res.json())
		console.log(validate)
		if (validate.me === config.baseUrl.href) {
			const sesh = c.get('session')
			sesh.set('user', 'admin')
			return c.redirect('/')
		} else {
			return c.html(<LoginForm error='IndieAuth login failed' />, 401)
		}
	})

	app.post('/logout', (c) => {
		const sesh = c.get('session')
		sesh.deleteSession()
		return c.redirect('/')
	})
}

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
			<h2>Log in with IndieAuth</h2>
			<form action='https://indieauth.com/auth' method='GET'>
				<button type='submit'>Sign In</button>
				<input type='hidden' name='me' value={config.baseUrl} />
				<input type='hidden' name='client_id' value={config.baseUrl} />
				<input
					type='hidden'
					name='redirect_uri'
					value={new URL('/.denizen/indieauth-cb', config.baseUrl)}
				/>
			</form>
		</main>
	</Layout>
)

// #endregion

// #endregion
