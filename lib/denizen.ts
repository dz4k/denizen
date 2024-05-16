import { Hono, jsxRenderer, serveStatic } from '../deps/hono.ts'
import {
	Session,
	sessionMiddleware,
} from './common/session.ts'

import './config.ts'
import './webmention/webmention.ts'

import { listen } from './queue.ts'
import { db } from './db.ts'
import * as config from './config.ts'

import * as fourOhFour from './404.tsx'
import * as o5command from './admin/console.tsx'
import * as initialSetup from './admin/initial-setup.tsx'
import { requireAdmin } from './admin/middleware.ts'
import * as posting from './blog/posting.tsx'
import * as webaction from './admin/webaction.tsx'
import * as wpAdmin from './admin/wp-admin.ts'
import * as importBlog from './admin/import-blog.tsx'
import * as indieAuth from './auth/indie-auth/indie-auth.tsx'
import * as indieauthCb from './auth/indieauth-cb.tsx'
import * as login from './auth/login.tsx'
import * as feed from './blog/feed.ts'
import * as homepage from './blog/homepage.tsx'
import * as post from './blog/post.tsx'
import * as storage from './storage/storage-routes.ts'
import * as fileManager from './storage/file-manager.tsx'
import * as micropub from './micropub/micropub.ts'
import * as webmentionRecv from './webmention/recv.ts'
import { StorageBackend } from './storage/storage-interface.ts'
import * as fsBackend from './storage/fs-backend.ts'

import { Layout } from './layout.ts'

listen()

export type Env = {
	Variables: {
		session: Session
		session_key_rotation: boolean
		authScopes: string[]
		storage: StorageBackend

		lang: string
		title: string
		theme: string
	}
}
export const app = new Hono<Env>()

app.use('*', (c, next) => (c.set('storage', fsBackend), next()))
app.use('*', async (c, next) => (c.set('theme', await config.theme()), next()))
app.use('*', async (c, next) => (c.set('lang', await config.lang()), next()))

app
	.use(
		'*',
		sessionMiddleware({
			db,
			namespace: ['Sessions'],
			expireSeconds: 60 * 60 * 24 * 7, // 1 week
		}),
	)
	.use(
		'/.denizen/public/*',
		serveStatic({
			root: './lib/public',
			rewriteRequestPath: (path) => path.slice('/.denizen/public'.length),
		}),
	)
	.use('*', jsxRenderer(Layout))
	.use('*', initialSetup.middleware)
	.get('/.denizen/initial-setup', initialSetup.get)
	.post('/.denizen/initial-setup', initialSetup.post)
	.get('/.denizen/post/new', posting.get)
	.post('/.denizen/post/new', requireAdmin, posting.post)
	.get('/.denizen/post/edit', posting.getEdit)
	.post('/.denizen/post/edit', posting.postEdit)
	.get('/.denizen/webaction', webaction.get)
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
	.get('/.well-known/oauth-authorization-server', indieAuth.getMetadata)
	.get('/.denizen/auth', indieAuth.getAuth)
	.post('/.denizen/auth', indieAuth.postAuth)
	.post('/.denizen/token', indieAuth.postToken)
	.post('/.denizen/auth/orize', indieAuth.postAuthorize)
	.get('/.denizen/indieauth-cb', indieauthCb.get)
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
