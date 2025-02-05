import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

export const cache: hono.MiddlewareHandler<Env> = async (c, next) => {
  let cache: Cache
  try {
    cache = await caches.open('denizen-request-cache')
  } catch {
    await next()
    return
  }

  if (!c.req.header('Cache-Control')?.includes('no-cache')) {
    const cachedRes = await cache.match(c.req.raw)
    if (cachedRes) {
      console.debug("Serving from cache", c.req.url)
      return cachedRes
    }
  }

  console.debug("Serving from DB", c.req.url)
  await next()
  cache.put(c.req.raw, c.res.clone())
}
