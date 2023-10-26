import { Hono } from '../deps/hono.ts'
import {
	DenoKvStore,
	Session,
	sessionMiddleware,
} from '../deps/hono_sessions.ts'

import './config.ts'
import './webmention-send.ts'

import { db } from './db.ts'

import * as fourOhFour from './routes/404.tsx'
import * as o5command from './routes/admin/console.tsx'
import * as initialSetup from './routes/admin/initial-setup.tsx'
import { requireAdmin } from './routes/admin/middleware.ts'
import * as posting from './routes/admin/posting.tsx'
import * as wpAdmin from './routes/admin/wp-admin.ts'
import * as indieauth from './routes/auth/indieauth.ts'
import * as login from './routes/auth/login.tsx'
import * as feed from './routes/blog/feed.ts'
import * as homepage from './routes/blog/homepage.tsx'
import * as post from './routes/blog/post.tsx'
import * as storage from './routes/storage/storage.ts'
import * as fileManager from './routes/storage/file-manager.tsx'
import * as assets from './routes/storage/assets.ts'
import * as micropub from './routes/micropub/micropub.ts'

export type Env = {
	Variables: {
		session: Session
		session_key_rotation: boolean
		authScopes: string[]
	}
}
export const app = new Hono<Env>()

app
	.use(
		'*',
		sessionMiddleware({
			store: new DenoKvStore(db, 'Sessions'),
			expireAfterSeconds: 60 * 60 * 24 * 7, // 1 week
			cookieOptions: { sameSite: 'Lax' },
		}),
	)
	.get(`/.denizen/public/:asset`, assets.get)
	.use('*', initialSetup.middleware)
	.get('/.denizen/initial-setup', initialSetup.get)
	.post('/.denizen/initial-setup', initialSetup.post)
	.get('/.denizen/post/new', posting.get)
	.post('/.denizen/post/new', requireAdmin, posting.post)
	.get('/.denizen/post/edit', posting.getEdit)
	.get('/.denizen/console', requireAdmin, o5command.get)
	.post('/.denizen/profile', requireAdmin, o5command.updateProfile)
	.post('/.denizen/site-settings', requireAdmin, o5command.updateSettings)
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
	.get('/', homepage.get)
	.get('/wp-admin/', wpAdmin.get)
	.get('/feed.json', feed.json)
	.get('/feed.xml', feed.xml)
	.get('*', post.get)
	.put('*', requireAdmin, post.put)
	.delete('*', requireAdmin, post.del)
	.notFound(fourOhFour.get)
