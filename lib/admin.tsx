/** @jsx jsx */
/** @jsxFrag Fragment */

import {
	Context,
	FC,
	Fragment,
	Hono,
	html,
	jsx,
	MiddlewareHandler,
} from '../deps/hono.ts'
import { app as AuthApp, signup } from './auth.tsx'
import {
	completeInitialSetup,
	createPost,
	getUser,
	initialSetupDone,
} from './db.ts'
import { Card, Post } from './model.ts'
import type { Env } from './server.tsx'
import * as config from '../config.ts'
import { Layout } from "./ui.tsx"

// #region Routes

const app = new Hono<Env>()
export default app

app.route('/auth', AuthApp)

export const isAdmin = (c: Context<Env>) =>
	c.get('session').get('user') === 'admin'

export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
	if (!isAdmin(c)) {
		if (c.req.method === "GET") return c.redirect("/.denizen/auth/login", 303)
		else return c.status(401)
	}
	else await next()
}

app.get('/initial-setup', (c) => c.html(<InitialSetup />))

app.post('/initial-setup', async (c) => {
	if (await initialSetupDone()) return c.status(403)
	const form = await c.req.formData()
	const pw = form.get('pw')
	if (typeof pw !== 'string') {
		return c.html(<InitialSetup error='Missing username or password' />, 400)
	}
	const displayName = form.get('name')
	if (typeof displayName !== 'string') {
		return c.html(<InitialSetup error='Please enter a name' />, 400)
	}
	await signup('admin', pw, new Card(displayName))
	await completeInitialSetup()

	const sesh = c.get('session')
	sesh.set('user', 'admin')
	return c.redirect('/', 303)
})

app.get('/post/new', (c) => c.html(<PostEditor />))

app.post('/post/new', requireAdmin, async (c) => {
	const formdata = await c.req.formData()

	const post = Post.fromFormData(formdata)
	await createPost(post)

	return c.redirect(post.uid!.pathname, 307)
})

// #endregion

// #region UI

export const PostEditor = () => (
	<Layout title='New Post'>
		<header>
			<h1>New Post</h1>
		</header>
		<main>
			<script type='module' src='/public/post-editor.js'></script>
			<post-editor></post-editor>
		</main>
	</Layout>
)

export const InitialSetup = (p: { error?: string }) => (
	<Layout title='Initial Setup -- Denizen'>
		<header>
			<h1>Welcome to Denizen</h1>
			<p class='big'>Choose a password to set up your site</p>
		</header>
		<main>
			{p.error && <div class='bad box'>{p.error}</div>}
			<form method='POST' class='table rows'>
				<p>
					<label for='edit-name'>Name</label>
					<span class='f-col'>
						<input
							type='text'
							name='name'
							id='edit-name'
							required
							aria-describedby='desc-edit-name'
						/>
						<span id='desc-edit-name' class='<small> italic'>
							Not a login username -- the name that will be displayed on your
							homepage.
						</span>
					</span>
				</p>
				<p>
					<label htmlFor='edit-pw'>Password</label>
					<input type='password' name='pw' id='edit-pw' required />
				</p>
				<p>
					<template />
					<button type='submit'>Get started</button>
				</p>
			</form>
		</main>
	</Layout>
)

// #endregion
