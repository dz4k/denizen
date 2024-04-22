import { Hono, serveStatic } from '../deps/hono.ts'
import {
	DenoKvStore,
	Session,
	sessionMiddleware,
} from '../deps/hono_sessions.ts'

import './config.ts'
import './webmention.ts'

import { listen } from './queue.ts'
import { db } from './db.ts'
import * as config from './config.ts'

import * as fourOhFour from './routes/404.tsx'
import * as o5command from './routes/admin/console.tsx'
import * as initialSetup from './routes/admin/initial-setup.tsx'
import { requireAdmin } from './routes/admin/middleware.ts'
import * as posting from './routes/admin/posting.tsx'
import * as wpAdmin from './routes/admin/wp-admin.ts'
import * as importBlog from './routes/admin/import-blog.tsx'
import * as indieauth from './routes/auth/indieauth.ts'
import * as login from './routes/auth/login.tsx'
import * as feed from './routes/blog/feed.ts'
import * as homepage from './routes/blog/homepage.tsx'
import * as post from './routes/blog/post.tsx'
import * as storage from './routes/storage/storage.ts'
import * as fileManager from './routes/storage/file-manager.tsx'
import * as micropub from './routes/micropub/micropub.ts'
import * as webmentionRecv from './routes/webmention/webmention-recv.ts'
import { StorageBackend } from './storage/storage-interface.ts'
import * as fsBackend from './storage/fs-backend.ts'

listen()

export type Env = {
	Variables: {
		session: Session
		session_key_rotation: boolean
		authScopes: string[]
		storage: StorageBackend
		theme: string
	}
}
export const app = new Hono<Env>()

app.use('*', (c, next) => (c.set('storage', fsBackend), next()))
app.use('*', async (c, next) => (c.set('theme', await config.theme()), next()))

app
	// @ts-expect-error session middleware types wrong?
	.use(
		'*',
		sessionMiddleware({
			store: new DenoKvStore(db, 'Sessions'),
			expireAfterSeconds: 60 * 60 * 24 * 7, // 1 week
			cookieOptions: { sameSite: 'Lax' },
		}),
	)
	.use(
		'/.denizen/public/*',
		serveStatic({
			root: './lib/public',
			rewriteRequestPath: (path) => path.slice('/.denizen/public'.length),
		}),
	)
	.use('*', initialSetup.middleware)
	.get('/.denizen/initial-setup', initialSetup.get)
	.post('/.denizen/initial-setup', initialSetup.post)
	.get('/.denizen/post/new', posting.get)
	.post('/.denizen/post/new', requireAdmin, posting.post)
	.get('/.denizen/post/edit', posting.getEdit)
	.post('/.denizen/post/edit', posting.postEdit)
	.get('/.denizen/console', requireAdmin, o5command.get)
	.post('/.denizen/profile', requireAdmin, o5command.updateProfile)
	.post('/.denizen/profile/badge', requireAdmin, o5command.postBadge)
	.delete('/.denizen/profile/badge/:iid', requireAdmin, o5command.deleteBadge)
	.post('/.denizen/site-settings', requireAdmin, o5command.updateSettings)
	.post('/.denizen/theme-settings', requireAdmin, o5command.updateTheme)
	.post('/.denizen/import-blog', requireAdmin, importBlog.post)
	.get('/.denizen/login', login.get)
	.post('/.denizen/login', login.post)
	.post('/.denizen/logout', login.logout)
	.get('/.denizen/indieauth-cb', indieauth.get)
	.get('/.denizen/storage/:filename{.+}', storage.get)
	.post('/.denizen/storage/:filename{.+}', requireAdmin, storage.post)
	.post('/.denizen/storage', requireAdmin, storage.postFormdata)
	.delete('/.denizen/storage/:filename{.+}', requireAdmin, storage.del)
	.all('/.denizen/storage', storage.queryParam)
	.get('/.denizen/files', requireAdmin, fileManager.get)
	.get('/.denizen/micropub', micropub.middleware, micropub.get)
	.post('/.denizen/micropub', micropub.middleware, micropub.post)
	.post('/.denizen/micropub/media', micropub.middleware, micropub.postMedia)
	.post('/.denizen/webmention', webmentionRecv.post)
	.get('/', homepage.get)
	.get('/wp-admin/', wpAdmin.get)
	.get('/feed.json', feed.json)
	.get('/feed.xml', feed.xml)
	.get('*', post.get)
	.put('*', requireAdmin, (c) => post.put(c))
	.delete('*', requireAdmin, post.del)
	.notFound(fourOhFour.get)
