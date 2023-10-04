import { monotonicUlid } from 'https://deno.land/std@0.203.0/ulid/mod.ts'

import { Post } from './model.ts'
import { asyncIteratorToArray } from './util.ts'
import { User } from "./auth.ts"

export const db = await Deno.openKv('dev.sqlite')

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
export const urlKey = (url: URL) => ['PostURL', url.href]

export const getPosts = async (
	{ limit = 20, cursor }: PaginationOptions = {},
): Promise<Page<Post>> => {
	// TODO: pagination options
	const list = db.list({ prefix: ['Post'] }, { limit, cursor, reverse: true })
	const res = await asyncIteratorToArray(list)
	const posts = res.map((kvEntry) => {
		const post = Post.fromMF2Json(kvEntry.value)
		post.iid = kvEntry.key.at(-1) as string
		return post
	}).filter(post => !post.deleted)
	return { data: posts, cursor: list.cursor }
}

export const getPost = async (iid: string): Promise<Post | null> => {
	const kvEntry = await db.get(['Post', iid])
	if (kvEntry.value === null) return null
	const post = Post.fromMF2Json(kvEntry.value)
	post.iid = iid
	return post
}

export const createPost = async (post: Post): Promise<string> => {
	post.iid ??= genIID()
	const myPostKey = postKey(post)
	const myUrlKey = urlKey(post.uid)
	await db.atomic()
		.check({ key: myPostKey, versionstamp: null })
		.check({ key: myUrlKey, versionstamp: null })
		.set(myPostKey, post.toMF2Json())
		.set(myUrlKey, post.iid)
		.commit()
	return post.iid
}

export const updatePost = async (post: Post): Promise<string> => {
	const key = postKey(post)
	await db.set(key, post.toMF2Json())
	return post.iid!
}

export const deletePost = (post: Post) => {
	post.deleted = true
	updatePost(post)
}

export const getPostByURL = async (url: URL): Promise<Post | null> => {
	const kvEntry = await db.get(urlKey(url))
	if (kvEntry.value === null) return null
	return getPost(kvEntry.value as string)
}

// #endregion

// #region Users

export const userKey = (username: string) => ["User", username]

export const createUser = async (user: User) => {
	const key = userKey(user.username)
	await db.atomic()
		.check({ key, versionstamp: null })
		.set(key, user.serialize())
		.commit()
}

export const getUser = async (username: string) => {
	const res = await db.get(userKey(username))
	return User.deserialize(res.value as Record<string, unknown>)
}

// #endregion

// #region Bookkeeping

export const initialSetupDone = async () => {
	const res = await db.get(["etc.", "Initial setup done"])
	return res.value
}

export const completeInitialSetup = async () => {
	await db.set(["etc.", "Initial setup done"], true)
}

// #region
