/** @jsx jsx */
/** @jsxFrag Fragment */

import { decodeBase64 } from 'https://deno.land/std@0.203.0/encoding/base64.ts'
import { contentType } from 'https://deno.land/std@0.203.0/media_types/content_type.ts'
import * as path from 'https://deno.land/std@0.203.0/path/mod.ts'

import { Context, Hono, jsx, MiddlewareHandler } from '../deps/hono.ts'

import {
	completeInitialSetup,
	createPost,
	getUser,
	initialSetupDone,
	updateUser,
} from './db.ts'
import type { Env } from './server.tsx'
import * as storage from './storage.tsx'
import * as config from '../config.ts'
import { Card, Post } from './model.ts'
import { makeSlug } from './slug.ts'
import { Layout } from './ui.tsx'
import { signup } from './auth.tsx'

export const isAdmin = (c: Context<Env>) =>
	c.var.session.get('user') === 'admin'

export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
	if (!isAdmin(c)) {
		if (c.req.method === 'GET') return c.redirect('/.denizen/login', 303)
		else return c.status(401)
	} else await next()
}

export default function installAdmin(app: Hono<Env>) {
	app.get('/initial-setup', (c) => c.html(<InitialSetup />))

	app.post('/initial-setup', async (c) => {
		if (await initialSetupDone()) return c.status(403)

		// Create admin account
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

		// Mark setup as completed
		await completeInitialSetup()

		// Sign in to admin account
		const sesh = c.get('session')
		sesh.set('user', 'admin')
		return c.redirect('/', 303)
	})

	app.get('/post/new', (c) => c.html(<PostEditor />))

	app.post('/post/new', requireAdmin, async (c) => {
		const formdata = await c.req.formData()

		const post = Post.fromFormData(formdata)
		post.uid = new URL(
			`${post.published.getFullYear()}/${
				post.name ? makeSlug(post.name) : post.published.toISOString()
			}`,
			config.baseUrl, // TODO derive this somehow
		)
		await createPost(post)

		return c.redirect(post.uid!.pathname, 307)
	})

	app.get('/console', requireAdmin, async (c) => {
		const user = await getUser(c.var.session.get('user') as string)

		return c.html(
			<Layout title='Console'>
				<script type='module' src='/.denizen/public/key-value-input.js' />
				<header>
					<h1>Console</h1>
				</header>
				<main>
					<section>
						<h2>Profile</h2>
						<form
							action='/.denizen/profile'
							method='POST'
							class='grid'
							style='grid: auto-flow / auto 1fr'
						>
							<p class='grid-row'>
								<label for='profile.name'>Name</label>
								<input
									type='text'
									id='profile.name'
									name='name'
									value={user.profile.name}
								/>
							</p>
							<p class='grid-row'>
								<label for='profile.bio'>Bio</label>
								<textarea name='note' id='profile.bio'>
									{user.profile.note}
								</textarea>
							</p>
							<p class='grid-row'>
								<label for='profile.socials'>Social links</label>
								<kv-input
									id='profile.socials'
									name='me'
									valuetype='url'
									value={JSON.stringify(user.profile.me)}
								/>
							</p>
							<p class='grid-row'>
								<span />
								<span>
									<button class="big">Save</button>
								</span>
							</p>
						</form>
					</section>
				</main>
			</Layout>,
		)
	})

	app.post('/profile', requireAdmin, async (c) => {
		const formdata = await c.req.formData()

		const user = await getUser('admin')
		user.profile.name = formdata.get('name') as string
		user.profile.note = [formdata.get('note') as string]

		const socials = formdata.getAll('me[value]')
		if (socials) {
			formdata.getAll('me[key]').forEach((name, i) => {
				name = (name as string).trim()
				const value = (socials[i] as string).trim()
				if (name !== '' && value != '') user.profile.me[name] = value
			})
		}

		await updateUser(user)

		return c.redirect('/.denizen/console', 303)
	})
}

// #region UI

export const PostEditor = () => (
	<Layout title='New Post'>
		<header>
			<h1>New Post</h1>
		</header>
		<main>
			<script type='module' src='/.denizen/public/post-editor.js'></script>
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
					<span class='table rows'>
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
					<label for='edit-pw'>Password</label>
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
