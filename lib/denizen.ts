import { Hono, serveStatic } from '../deps/hono.ts'
import { Session, sessionMiddleware } from './common/session.ts'

import { listen } from './queue.ts'
import { db, getConfigs } from './db.ts'
import * as fourOhFour from './404.ts'
import * as o5command from './admin/console.ts'
import * as initialSetup from './admin/initial-setup.ts'
import { requireAdmin } from './admin/middleware.ts'
import * as posting from './blog/posting.ts'
import * as webaction from './admin/webaction.ts'
import * as wpAdmin from './admin/wp-admin.ts'
import * as importBlog from './admin/import-blog.ts'
import * as indieAuth from './auth/indie-auth/indie-auth.ts'
import * as indieauthCb from './auth/indieauth-cb.ts'
import * as login from './auth/login.ts'
import * as feed from './blog/feed.ts'
import * as homepage from './blog/homepage.ts'
import * as entry from './blog/entry.ts'
import * as storage from './storage/storage-routes.ts'
import * as fileManager from './storage/file-manager.ts'
import * as micropub from './micropub/micropub.ts'
import * as webmentionRecv from './webmention/recv.ts'
import { StorageBackend } from './storage/storage-interface.ts'
import * as fsBackend from './storage/fs-backend.ts'
import { cache } from './common/cache.ts'

import render from './common/vento.ts'

listen()

export type Env = {
  Variables: {
    session: Session
    session_key_rotation: boolean
    authScopes: string[]
    storage: StorageBackend

    locales: string[]
    lang: string
    title: string
    theme: string
    accentHue: string
    baseUrl: URL

    render: (
      template: string,
      data?: Record<string, unknown>,
    ) => Response | Promise<Response>
    href: (url?: string | URL) => string | undefined
  }
}
export const app = new Hono<Env>()

app.use('*', async (c, next) => {
  const config = await getConfigs()
  c.set('storage', fsBackend)
  c.set('theme', config['theme'] as string ?? 'default')
  c.set('accentHue', config['accent hue'] as string)
  c.set('locales', config['locales'] as string[])
  c.set('lang', (config['locales'] as string[])?.[0])
  c.set('baseUrl', new URL(config['base url'] as string ?? 'https://initial.invalid'))
  c.set(
    'render',
    async (template: string, data?: Record<string, unknown>) =>
      c.html(await render(c, template, data)),
  )
  c.set(
    'href',
    (url?: string | URL) => {
      if (!url) return url
      const u = new URL(url)
      if (u.origin === c.var.baseUrl?.origin)
        return u.pathname + u.search + u.hash
      return u.href
    }
  )
  await next()
})

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
      root: import.meta.dirname + '/public',
      rewriteRequestPath: (path) => path.slice('/.denizen/public'.length),
    }),
  )
  .use('*', initialSetup.middleware)
  .get('/.denizen/initial-setup', initialSetup.get)
  .post('/.denizen/initial-setup', initialSetup.post)
  .get('/.denizen/entry/new', posting.get)
  .post('/.denizen/entry/new', requireAdmin, posting.post)
  .get('/.denizen/entry/edit', posting.getEdit)
  .post('/.denizen/entry/edit', posting.postEdit)
  .get('/.denizen/webaction', webaction.get)
  .get('/.denizen/console', requireAdmin, o5command.get)
  .post('/.denizen/profile', requireAdmin, o5command.updateProfile)
  .post('/.denizen/profile/badge', requireAdmin, o5command.postBadge)
  .delete('/.denizen/profile/badge/:iid', requireAdmin, o5command.deleteBadge)
  .post('/.denizen/site-settings', requireAdmin, o5command.updateSettings)
  .post('/.denizen/theme-settings', requireAdmin, o5command.updateTheme)
  .post('/.denizen/import-blog', requireAdmin, importBlog.post)
  .get('/.denizen/import-blog/:id', requireAdmin, importBlog.getJob)
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
  .get('*', cache, entry.get)
  .put('*', requireAdmin, (c) => entry.put(c))
  .delete('*', requireAdmin, entry.del)
  .notFound(fourOhFour.get)
