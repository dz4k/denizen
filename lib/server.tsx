/** @jsx jsx */
/** @jsxFrag Fragment */

import { Fragment, Hono, jsx, serveStatic } from '../deps/hono.ts'
import * as config from '../config.ts'

import { FourOhFour, HomePage, PostEditor, PostPage } from './ui.tsx'
import { Post } from './model.ts'
import { getPost, getPostByURL, getPosts, savePost } from './db.ts'

export const app = new Hono()

app.use('/public/*', serveStatic({ root: '.' }))

app.get('/', async (c) =>
	c.html(
		<HomePage posts={await getPosts()} />,
	))

// TODO: authenticate
app.get('/post/new', (c) => c.html(<PostEditor />))

app.post('/post/new', async (c) => {
	const formdata = await c.req.formData()

	const post = Post.fromFormData(formdata, config.baseUrl)
	savePost(post)

	return c.redirect(post.uid.href, 307)
})

app

app.get('*', async (c) => {
	const uid = new URL(c.req.path, config.baseUrl)
	const post = await getPostByURL(uid)
	if (post === null) return c.notFound()
	return c.html(<PostPage post={post} />)
})

app.notFound((c) => c.html(<FourOhFour />))
