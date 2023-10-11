/** @jsx jsx */
/** @jsxFrag Fragment */

import {
	Context,
	Fragment,
	Hono,
	jsx,
	MiddlewareHandler,
} from '../deps/hono.ts'
import {
	DenoKvStore,
	Session,
	sessionMiddleware,
} from '../deps/hono_sessions.ts'

import * as config from '../config.ts'

import { FourOhFour, HomePage, Layout, PostDeleted, PostPage } from './ui.tsx'
import {
	completeInitialSetup,
	createPost,
	db,
	deletePost,
	getPostByURL,
	getPosts,
	getUser,
	initialSetupDone,
} from './db.ts'
import { Card, Post } from './model.ts'
import { login, signup } from './auth.ts'
import { makeSlug } from './slug.ts'
import * as storage from './storage.ts'
import { asyncIteratorToArray } from './util.ts'
import { decodeBase64 } from 'https://deno.land/std@0.203.0/encoding/base64.ts'
import { contentType } from "https://deno.land/std@0.203.0/media_types/content_type.ts";
import * as path from 'https://deno.land/std@0.203.0/path/extname.ts'

export type Env = {
	Variables: {
		session: Session
		session_key_rotation: boolean
	}
}

export const app = new Hono<Env>()

app.use(
	'*',
	sessionMiddleware({
		store: new DenoKvStore(db, 'Sessions'),
		expireAfterSeconds: 60 * 60 * 24 * 7, // 1 week
		cookieOptions: { sameSite: 'Lax' },
	}),
)

// Do not serve any pages until initial setup is done
app.use(async (c, next) => {
	if (
		c.req.path !== '/.denizen/initial-setup' &&
		!c.req.path.startsWith('/public/') && !await initialSetupDone()
	) {
		return c.redirect('/.denizen/initial-setup', 303)
	} else await next()
})

app.get('/', async (c) =>
	c.html(
		<HomePage
			posts={await getPosts()}
			admin={isAdmin(c)}
			siteOwner={await getUser('admin')}
		/>,
	))

const internals = app.basePath('/.denizen')

// #region Auth

internals.get('/login', (c) => c.html(<LoginForm />))

internals.post('/login', async (c) => {
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

internals.post('/logout', (c) => {
	const sesh = c.get('session')
	sesh.deleteSession()
	return c.redirect('/')
})

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

// #endregion

// #region Admin

export const isAdmin = (c: Context<Env>) =>
	c.var.session.get('user') === 'admin'

export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
	if (!isAdmin(c)) {
		if (c.req.method === 'GET') return c.redirect('/.denizen/login', 303)
		else return c.status(401)
	} else await next()
}

app.get(
	'/wp-admin/',
	(c) => c.redirect('https://youtube.com/watch?v=dQw4w9WgXcQ'),
)

internals.get('/initial-setup', (c) => c.html(<InitialSetup />))

const ilog = (a) => (console.log(a), a)

internals.post('/initial-setup', async (c) => {
	if (await initialSetupDone()) return c.status(403)

	// Bootstrap static assets
	const assets = (await import(
		'../build/assets.json',
		{ assert: { type: 'json' } }
	)).default
	await Promise.all(
		Object.entries(assets).map(([name, b64]) =>
			storage.write(
				name,
				new Blob([decodeBase64(ilog(b64) as string)], {
					type: contentType(path.extname(name))
				})
			)
		),
	)

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

internals.get('/post/new', (c) => c.html(<PostEditor />))

internals.post('/post/new', requireAdmin, async (c) => {
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

// #region UI

export const PostEditor = () => (
	<Layout title='New Post'>
		<header>
			<h1>New Post</h1>
		</header>
		<main>
			<script type='module' src='/.denizen/storage/post-editor.js'></script>
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

// #endregion

// #region Files

internals.get('/storage/:filename{.+}', async (c) => {
	const filename = c.req.param('filename')
	if (!filename) return c.body('', 400)
	try {
		const blob = await storage.read(filename)
		console.log(blob)
		return c.body(blob.stream(), 200, {
			'Content-Type': blob.type,
		})
	} catch {
		return c.body('', 404)
	}
})

internals.delete('/storage/:filename{.+}', async (c) => {
	const filename = c.req.param('filename')
	if (!filename) return c.body('', 400)
	try {
		await storage.del(filename)
		return c.body('', 200)
	} catch {
		return c.body('', 404)
	}
})

internals.post('/storage/:filename{.+}', requireAdmin, async (c) => {
	const filename = c.req.param('filename')

	await storage.write(filename, await c.req.blob())
	return c.redirect('/.denizen/files')
})

internals.post('/storage', requireAdmin, async (c) => {
	const formdata = await c.req.formData()

	const file = formdata.get('file')
	if (!file || !(file instanceof File)) return c.body('No file!', 400)
	await storage.write(file.name, file)
	return c.redirect('/.denizen/files')
})

internals.all('/storage', (c) => {
	const filename = c.req.query('filename')
	if (!filename) return c.body('', 400)
	return c.redirect('/.denizen/storage/' + encodeURIComponent(filename), 308)
})

internals.get('/files', async (c) => {
	const files = await asyncIteratorToArray(storage.list())
	return c.html(
		<Layout title='Files -- Denizen'>
			<header>
				<h1>Files</h1>
			</header>
			<main>
				{files.length
					? (
						<table style="width: 100%">
							<col />
							<col width="0.1%" />
							<thead>
								<tr>
									<th>Filename</th>
									<th>Actions</th>
								</tr>
							</thead>
							{files.map((file) => (
								<tr>
									<td>{file}</td>
									<td style="white-space: nowrap">
										<a
											download={file}
											href={`/.denizen/storage?filename=${file}`}
											class='<button>'
										>
											Download
										</a>{' '}
										<button
											hx-delete={`/.denizen/storage?filename=${file}`}
											hx-target='closest tr'
										>
											Delete
										</button>
									</td>
								</tr>
							))}
						</table>
					)
					: <p class='center big'>No files</p>}

				<h2>Add file</h2>
				<form
					action='/.denizen/storage'
					method='POST'
					enctype='multipart/form-data'
					class='table rows'
				>
					<label>
						<span>File</span>
						<input type='file' name='file' />
					</label>
					<button type='submit'>Upload</button>
				</form>
			</main>
		</Layout>,
	)
})

// #endregion

const accessPost = (c: Context<Env>) =>
	getPostByURL(new URL(c.req.path, config.baseUrl))

app.get('*', async (c) => {
	const post = await accessPost(c)
	if (post === null) return c.notFound()
	if (post.deleted) return c.html(<PostDeleted />, 410) // "Gone"
	return c.html(<PostPage post={post} admin={isAdmin(c)} />)
})

app.delete('*', requireAdmin, async (c) => {
	const post = await accessPost(c)
	if (post === null) return c.notFound()
	deletePost(post)
	c.header('HX-Redirect', '/')
	return c.redirect('/', 303)
})

app.notFound((c) => c.html(<FourOhFour />))
