/** @jsx jsx */
/** @jsxFrag Fragment */

import { Context, Fragment, Hono, jsx, serveStatic } from '../deps/hono.ts'
import {
	DenoKvStore,
	Session,
	sessionMiddleware,
} from '../deps/hono_sessions.ts'

import * as config from '../config.ts'

import { FourOhFour, HomePage, PostDeleted, PostPage } from './ui.tsx'
import {
	db,
	deletePost,
	getPostByURL,
	getPosts,
	getUser,
	initialSetupDone,
} from './db.ts'
import { currentUser } from './auth.tsx'
import Admin, { isAdmin, requireAdmin } from './admin.tsx'

export type Env = {
	Variables: {
		session: Session
		session_key_rotation: boolean
	}
}

export const app = new Hono<Env>()

app.route('/.denizen/', Admin)

app.use(sessionMiddleware({
	store: new DenoKvStore(db, 'Sessions'),
	expireAfterSeconds: 60 * 60 * 24 * 7, // 1 week
	cookieOptions: {
		sameSite: 'Lax',
	},
}))

app.use('*', async (c, next) => {
	if (
		c.req.path !== '/.denizen/initial-setup' &&
		!c.req.path.startsWith('/public/') && !await initialSetupDone()
	) {
		return c.redirect('/.denizen/initial-setup', 303)
	} else await next()
})

app.use('/public/*', serveStatic({ root: '.' }))

app.get('/', async (c) =>
	c.html(
		<HomePage
			posts={await getPosts()}
			admin={isAdmin(c)}
			siteOwner={await getUser('admin')}
		/>,
	))

app.get(
	'/wp-admin/',
	(c) => c.redirect('https://youtube.com/watch?v=dQw4w9WgXcQ'),
)

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
