/** @jsx jsx */
/** @jsxFrag Fragment */

import {
Context,
	Fragment,
	Hono,
	jsx,
	MiddlewareHandler,
	serveStatic,
} from '../deps/hono.ts'
import {
	DenoKvStore,
	Session,
	sessionMiddleware,
} from '../deps/hono_sessions.ts'

import * as config from '../config.ts'

import {
	FourOhFour,
	HomePage,
	InitialSetup,
	LoginForm,
	PostEditor,
	PostPage,
} from './ui.tsx'
import { Card, Post } from './model.ts'
import {
	completeInitialSetup,
	createPost,
	createUser,
	db,
	getPost,
	getPostByURL,
	getPosts,
	initialSetupDone,
} from './db.ts'
import { login, signup } from './auth.ts'

type Env = {
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
		cookieOptions: {
			sameSite: 'Lax',
		},
	}),
)

app.use('*', async (c, next) => {
	if (
		c.req.path !== '/.denizen/initial-setup' &&
		!c.req.path.startsWith('/public/') && !await initialSetupDone()
	) {
		return c.redirect('/.denizen/initial-setup', 303)
	} else await next()
})

const isAdmin = (c: Context<Env>) => c.get('session').get('user') === 'admin'

const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
	if (!isAdmin(c)) return c.status(401)
	else await next()
}

app.use('/public/*', serveStatic({ root: '.' }))

app.get('/', async (c) =>
	c.html(
		<HomePage posts={await getPosts()} canPost={isAdmin(c)} />,
	))

app.get(
	'/wp-admin/',
	(c) => c.redirect('https://youtube.com/watch?v=dQw4w9WgXcQ'),
)

app.get('/.denizen/initial-setup', (c) => c.html(<InitialSetup />))

app.post('/.denizen/initial-setup', async (c) => {
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

app.get('/.denizen/login', (c) => c.html(<LoginForm />))

app.post('/.denizen/login', async (c) => {
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

app.post('/.denizen/logout', async (c) => {
	const sesh = c.get('session')
	sesh.deleteSession()
	return c.redirect('/')
})

app.get('/.denizen/post/new', (c) => c.html(<PostEditor />))

app.post('/.denizen/post/new', requireAdmin, async (c) => {
	const formdata = await c.req.formData()

	const post = Post.fromFormData(formdata, config.baseUrl)
	createPost(post)

	return c.redirect(post.uid.pathname, 307)
})

app.get('*', async (c) => {
	const uid = new URL(c.req.path, config.baseUrl)
	const post = await getPostByURL(uid)
	if (post === null) return c.notFound()
	return c.html(<PostPage post={post} />)
})

app.notFound((c) => c.html(<FourOhFour />))
