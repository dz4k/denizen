import { monotonicUlid } from 'https://deno.land/std@0.203.0/ulid/mod.ts'

import { Post } from './model.ts'
import { asyncIteratorToArray } from './util.ts'

const kv = await Deno.openKv('dev.sqlite')

/**
 * Generate an UUIDv7
 * TODO: is this good? should I use a different format?
 */
const genIID = monotonicUlid

export type Page<T> = { data: T[]; cursor: string }
export type PaginationOptions = {
	limit?: number
	cursor?: string
}

// #region Posts

export const postKey = (post: Post) => ['Post', post.iid!]

export const getPosts = async (
	{ limit = 20, cursor }: PaginationOptions = {},
): Promise<Page<Post>> => {
	// TODO: pagination options
	const list = kv.list({ prefix: ['Post'] }, { limit, cursor, reverse: true })
	const res = await asyncIteratorToArray(list)
	const posts = res.map((kvEntry) => {
		const post = Post.fromMF2Json(kvEntry.value)
		post.iid = kvEntry.key.at(-1) as string
		return post
	})
	return { data: posts, cursor: list.cursor }
}

export const getPost = async (iid: string): Promise<Post | null> => {
	const kvEntry = await kv.get(['Post', iid])
	if (kvEntry.value === null) return null
	const post = Post.fromMF2Json(kvEntry.value)
	post.iid = iid
	return post
}

export const savePost = async (post: Post): Promise<string> => {
	post.iid ??= genIID()
	await kv.set(postKey(post), post.toMF2Json())
	await putPostAtURL(post.uid, post, { permalink: true })
	return post.iid
}

export const deletePost = (post: Post) => kv.delete(postKey(post))

// #endregion

// #region Post URLs

export const urlKey = (url: URL) => ['PostURL', url.href]

export const getPostByURL = async (url: URL): Promise<Post | null> => {
	const kvEntry = await kv.get(urlKey(url))
	if (kvEntry.value === null) return null
	return getPost(kvEntry.value as string)
}

export const putPostAtURL = async (
	url: URL,
	post: Post,
	{ permalink = true },
) => {
	await kv.set(urlKey(url), post.iid)
	if (permalink) post.uid = url
	else post.url.add(url)
	await savePost(post)
}

export const removePostFromURL = (url: URL) => kv.delete(urlKey(url))
