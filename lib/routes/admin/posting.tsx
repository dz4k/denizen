/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import { Post } from '../../model.ts'
import { makeSlug } from '../../common/slug.ts'
import * as config from '../../config.ts'
import { createPost } from '../../db.ts'

export const get = (c: hono.Context<Env>) => c.html(<PostEditor />)

export const post = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()

	const post = Post.fromFormData(formdata)
	post.uid = new URL(
		`${post.published.getFullYear()}/${
			post.name ? makeSlug(post.name) : post.published.toISOString()
		}`,
		config.baseUrl, // TODO derive this somehow
	)
	await createPost(post)

	return c.redirect(post.uid!.pathname, 307)
}

const PostEditor = () => (
	<Layout title='New Post'>
		<header>
			<h1>New Post</h1>
		</header>
		<main>
			<script type='module' src='/.denizen/public/post-editor.js'></script>
			<post-editor></post-editor>
		</main>
	</Layout>
)
