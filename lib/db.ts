import { Post, Webmention, WMResponseType } from './model.ts'
import { asyncIteratorToArray } from './common/util.ts'
import { User } from './model.ts'
import { ulid } from 'https://deno.land/std@0.203.0/ulid/mod.ts'
import { enqueue } from './queue.ts'

export const db = Deno.env.get('LOCAL_DEV')
	? await Deno.openKv('dev.sqlite')
	: await Deno.openKv()

export type Page<T> = { data: T[]; cursor: string }
export type PaginationOptions = {
	limit?: number
	cursor?: string
}

export const postKey = (post: Post) => ['Post', post.iid!]
export const urlKey = (url: URL) => ['PostURL', url.pathname]
export const lastmodKey = ['Last modified']

export const lastMod = async () => {
	const res = await db.get(lastmodKey)
	return res.value as number ?? 0
}

export const bump = (tx: Deno.AtomicOperation) => tx.set(lastmodKey, Date.now())

// #region Posts

export const getPosts = async (
	{ limit = 100, cursor }: PaginationOptions = {},
): Promise<Page<Post>> => {
	// TODO: pagination options
	const list = db.list({ prefix: ['Post'] }, { limit, cursor, reverse: true })
	const res = await asyncIteratorToArray(list)
	const posts = res.map((kvEntry) => {
		const post = Post.fromMF2Json(kvEntry.value)
		post.iid = kvEntry.key.at(-1) as string
		return post
	}).filter((post) => !post.deleted)
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
	const myPostKey = postKey(post)
	const myUrlKey = post.uid && urlKey(post.uid)
	const tx = db.atomic()
	tx.check({ key: myPostKey, versionstamp: null })
	myUrlKey && tx.check({ key: myUrlKey, versionstamp: null })
	tx.set(myPostKey, post.toMF2Json())
	myUrlKey && tx.set(myUrlKey, post.iid)
	bump(tx)
	await tx.commit()

	// TODO: this doesn't feel like it belongs here
	await enqueue({
		type: 'send_webmentions',
		post: post.toMF2Json(),
	})
	return post.iid
}

export const updatePost = async (post: Post): Promise<string> => {
	post.updated = new Date()
	const key = postKey(post)
	const tx = db.atomic()
	tx.set(key, post.toMF2Json())
	bump(tx)
	await tx.commit()

	// TODO: this doesn't feel like it belongs here
	await enqueue({
		type: 'send_webmentions',
		post: post.toMF2Json(),
	})
	return post.iid!
}

export const deletePost = async (post: Post) => {
	post.deleted = true
	await updatePost(post)
}

export const undeletePost = async (post: Post) => {
	post.deleted = false
	await updatePost(post)
}

export const getPostByURL = async (url: URL): Promise<Post | null> => {
	const kvEntry = await db.get(urlKey(url))
	if (kvEntry.value === null) return null
	return getPost(kvEntry.value as string)
}

// #endregion

// #region Webmentions

export const saveWebmention = async (post: Post, wm: Webmention) => {
	const srcDstKey = ['WMBySrcDst', wm.source, wm.target]
	const existing = await db.get(srcDstKey)
	if (existing.value) {
		return db.atomic()
			.set(existing.value as Deno.KvKey, wm.serialize())
			.commit()
	}
	const iid = [
		'WM',
		post.iid,
		wm.responseType,
		ulid(),
	]
	return db.atomic()
		.check({ key: srcDstKey, versionstamp: existing.versionstamp })
		.set(srcDstKey, iid)
		.set(iid, wm.serialize())
		.sum(['WMCount', post.iid], 1n)
		.sum(['WMCount', post.iid, wm.responseType], 1n)
		.commit()
}

export const deleteWebmention = async (post: Post, wm: Webmention) => {
	const srcDstKey = ['WMBySrcDst', wm.source, wm.target]
	const existing = await db.get(srcDstKey)
	if (existing.value === null) return
	return db.atomic()
		.delete(srcDstKey)
		.delete(existing.value as Deno.KvKey)
		.sum(['WMCount', post.iid], -1n)
		.sum(['WMCount', post.iid, wm.responseType], -1n)
		.commit()
}

export const getWebmentions = async (
	post: Post,
	type: WMResponseType,
	options: PaginationOptions = {},
): Promise<Page<Webmention>> => {
	const list = db.list({ prefix: ['WM', post.iid, type] }, {
		...options,
		reverse: true,
	})
	const entries = await asyncIteratorToArray(list)
	const webmentions = entries.map((entry) =>
		Webmention.deserialize(entry.value as Record<string, unknown>)
	)
	return { data: webmentions, cursor: list.cursor }
}

export const getWebmentionCount = async (
	post: Post,
	type: WMResponseType,
) => (await db.get(['WMCount', post.iid, type])).value ?? 0

// #endregion

// #region Users

export const userKey = (username: string) => ['User', username]

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

export const updateUser = async (user: User) => {
	const key = userKey(user.username)
	await db.set(key, user.serialize())
}

// #endregion

// #region Bookkeeping

export const initialSetupDone = async () => {
	const res = await db.get(['etc.', 'Initial setup done'])
	return res ? res.value : false
}

export const completeInitialSetup = async () => {
	await db.set(['etc.', 'Initial setup done'], true)
}

// #region

// #region Config

export const getConfig = async (name: string) => {
	const res = await db.get(['Cfg', name])
	return res.value
}

export const setConfig = (name: string, value: unknown) =>
	db.set(['Cfg', name], value)

// #endregion
