import * as path from 'jsr:@std/path@1.0.8/extname'
import * as mediaType from 'jsr:@std/media-types@1.1.0'

import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'
import {
  createEntry,
  deleteEntry,
  getEntryByURL,
  undeleteEntry,
  updateEntry,
} from '../db.ts'
import { Entry } from '../model/entry.ts'
import { isAdmin } from '../admin/middleware.ts'
import { makeSlug } from '../common/slug.ts'
import { getTokenData } from '../auth/indie-auth/indie-auth.ts'
import { ulid } from 'jsr:@std/ulid@1.0.0'

/*
    A conforming Micropub server:

        MUST support both header and form parameter methods of authentication
        MUST support creating posts with the [h-entry] vocabulary
        MUST support creating posts using the x-www-form-urlencoded syntax
        SHOULD support updating and deleting posts
        Servers that support updating posts MUST support JSON syntax and the source content query
        Servers that do not specify a Media Endpoint MUST support multipart/form-data requests for creating posts
        Servers that specify a Media Endpoint MUST support the configuration query, other servers SHOULD support the configuration query
 */

/**
 * Authorize Micropub requests.
 */
export const middleware: hono.MiddlewareHandler<Env> = async (c, next) => {
  if (isAdmin(c)) {
    // Authorized via session.
    return next()
  }

  // Authorize via IndieAuth
  let token
  try {
    const formdata = await c.req.parseBody()
    token = formdata['access_token']
  } catch {
    // no formdata
  }
  if (token === null || token === undefined) {
    const auth = c.req.header('Authorization')
    if (!auth || !auth.startsWith('Bearer')) {
      return unauthorized(c)
    }
    token = auth.slice(7)
  } else {
    if (c.req.header('Authorization')) return badRequest(c)
  }
  const auth = await getTokenData(token as string)
  if (!auth) return forbidden(c)

  c.set('authScopes', auth.scopes)

  return next()
}

export const get = async (c: hono.Context<Env>) => {
  const q = c.req.query('q')
  if (q === 'config') {
    return c.json({
      'media-endpoint': new URL('/.denizen/micropub/media', c.var.baseUrl).href,
    })
  }
  if (q === 'source') {
    let url
    try {
      url = new URL(c.req.query('url')!)
    } catch {
      return badRequest(c)
    }
    const post = await getEntryByURL(new URL(url))
    return c.json(post?.toMF2Json())
  }
  if (q === 'syndicate-to') {
    return c.json({ 'syndicate-to': [] })
  }
  return c.json({ error: 'query_not_implemented' }, 400)
}

const fileProperties = new Set(
  ['photo', 'video', 'audio'].flatMap((prop) => [prop, prop + '[]']),
)

export const post = async (c: hono.Context<Env>) => {
  if (!c.var.authScopes.includes('create')) return insufficientScope(c)

  const [mime] = mediaType.parseMediaType(c.req.header('Content-Type')!)
  const reqBody = mime === 'application/json'
    ? await c.req.json()
    : await c.req.parseBody()

  if (reqBody.action === 'delete') {
    if (!c.var.authScopes.includes('update')) return insufficientScope(c)
    let url
    try {
      url = new URL(reqBody.url)
    } catch {
      return badRequest(c)
    }
    const post = await getEntryByURL(url)
    if (!post) return c.json({ error: 'not_found' }, 404)
    await deleteEntry(post)
    return c.body('', 200)
  } else if (reqBody.action === 'undelete') {
    if (!c.var.authScopes.includes('update')) return insufficientScope(c)
    let url
    try {
      url = new URL(reqBody.url)
    } catch {
      return badRequest(c)
    }
    const post = await getEntryByURL(url)
    if (!post) return c.json({ error: 'not_found' }, 404)
    await undeleteEntry(post)
    return c.body('', 200)
  } else if (reqBody.action === 'update') {
    if (
      !(typeof reqBody.replace === 'object' ||
        typeof reqBody.add === 'object' ||
        typeof reqBody.delete === 'object')
    ) {
      return badRequest(c)
    }
    const post = await getEntryByURL(new URL(reqBody.url))
    if (!post) return badRequest(c)
    if (reqBody.replace) post.replace(reqBody.replace)
    if (reqBody.add) post.add(reqBody.add)
    if (reqBody.delete) post.delete(reqBody.delete)
    await updateEntry(post)
    return c.body(null, 204)
  } else {
    // Create post

    // Upload files
    let formData: FormData
    if (
      mime === 'application/x-www-form-urlencoded' ||
      mime === 'multipart/form-data'
    ) {
      formData = await c.req.formData()
      const upload = async (file: File) => {
        const filename = ulid()
        await c.var.storage.write(
          filename,
          file,
          { cacheControl: 'public, max-age=31536000, immutable' },
        )
        return new URL(
          `/.denizen/storage/${encodeURIComponent(filename)}`,
          c.var.baseUrl,
        ).href
      }
      for (const prop of fileProperties) {
        const values = formData.getAll(prop)
        formData.delete(prop)
        for (const value of values) {
          if (value instanceof File) formData.append(prop, await upload(value))
          else formData.append(prop, value)
        }
      }
    }

    if (!c.var.authScopes.includes('create')) return insufficientScope(c)
    const createdPost = mime === 'application/json'
      ? Entry.fromMF2Json(reqBody)
      : Entry.fromFormData(formData!)
    // TODO: This is duplicated from routes/admin/posting.tsx#post.
    // Factor out and move somewhere sensible.
    // also make customizable.
    createdPost.uid ??= new URL(
      `${createdPost.published.getFullYear()}/${
        createdPost.name
          ? makeSlug(createdPost.name)
          : createdPost.published.toISOString()
      }`,
      c.var.baseUrl, // TODO derive this somehow
    )
    await createEntry(createdPost)

    return c.body('', 201, {
      'Location': createdPost.uid!.href,
    })
  }
}

export const postMedia = async (c: hono.Context<Env>) => {
  if (!c.var.authScopes.includes('create')) return forbidden(c)
  // if (!c.var.authScopes.includes('media')) return forbidden(c)
  const formdata = await c.req.formData()
  const file = formdata.get('file')
  if (!file || !(file instanceof File)) return badRequest(c)
  const name = ulid() + path.extname(file.name)
  await c.var.storage.write(name, file, {
    cacheControl: 'public, max-age=31536000, immutable',
  })
  return c.body('', 201, {
    'Location':
      new URL(`/.denizen/storage/${encodeURIComponent(name)}`, c.var.baseUrl)
        .href,
  })
}

const badRequest = (c: hono.Context) =>
  c.json({ error: 'invalid_request' }, 400)
const unauthorized = (c: hono.Context) => c.json({ error: 'unauthorized' }, 401)
const forbidden = (c: hono.Context) => c.json({ error: 'forbidden' }, 403)
const insufficientScope = (c: hono.Context) =>
  c.json({ error: 'insufficient_scope' }, 401)
