import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import {
  deletePost,
  getPostByURL,
  getUser,
  getWebmentions,
  updatePost,
} from '../db.ts'
import { isAdmin } from '../admin/middleware.ts'
import { Entry } from '../model/entry.ts'
import { clientRedirect } from '../common/util.ts'

const accessPost = (c: hono.Context<Env>) =>
  getPostByURL(new URL(c.req.path, c.var.baseUrl))

export const get = async (c: hono.Context<Env>) => {
  const post = await accessPost(c)
  if (post === null) return c.notFound()

  c.header('Vary', 'Accept')
  c.header('Vary', 'Cookie')

  if (/application\/(mf2\+)json/i.test(c.req.header('Accept')!)) {
    if (post.deleted) return c.json({ deleted: true }, 410)
    return c.json(post.toMF2Json())
  }

  if (post.deleted) {
    c.status(410)
    c.set('title', 'Deleted post')
    return c.var.render('410.vto')
  }

  const admin = isAdmin(c)
  const siteOwner = await getUser('admin')

  c.header('Link', '</.denizen/webmention>; rel="webmention"')
  c.header('Last-Modified', (post.updated ?? post.published).toUTCString())

  c.set('title', post.name ?? post.summary ?? post.published.toLocaleString())
  c.set('lang', post.language ?? c.var.lang)

  const [likes, reposts, mentions, replies] = await Promise.all([
    getWebmentions(post, 'like'),
    getWebmentions(post, 'repost'),
    getWebmentions(post, 'mention'),
    getWebmentions(post, 'reply'),
  ])

  return c.var.render('post.vto', {
    post,
    admin,
    siteOwner,
    webmentions: { likes, reposts, mentions, replies },
  })
}

export const put = async (
  c: hono.Context<Env>,
  url = new URL(c.req.url),
) => {
  const oldPost = await getPostByURL(url)
  if (!oldPost) return c.notFound()

  const formdata = await c.req.formData()

  const newPost = await Entry.fromFormDataWithFiles(
    formdata,
    c.var.storage,
    c.var.baseUrl!,
  )
  newPost.iid = oldPost.iid
  newPost.uid = oldPost.uid
  await updatePost(newPost)

  if (c.req.header('Soiree')) {
    return c.html(
      hono.html`<script>location='${newPost.uid!.pathname}'</script>`,
    )
  } else {
    return c.body(null, 303, {
      'Location': newPost.uid!.pathname,
    })
  }
}

export const del = async (c: hono.Context<Env>) => {
  const post = await accessPost(c)
  if (post === null) return c.notFound()
  await deletePost(post)
  if (c.req.header('Soiree')) {
    return c.html(clientRedirect('/'))
  }
  return c.redirect('/', 303)
}
