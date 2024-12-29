import { Entry } from './model/entry.ts'
import { Webmention, WMResponseType } from './model/webmention.ts'
import { asyncIteratorToArray } from './common/util.ts'
import { User } from './model/user.ts'
import { ulid } from 'https://deno.land/std@0.203.0/ulid/mod.ts'
import { enqueue } from './queue.ts'
import type { BlogImportJob } from './import-blog.ts'
import { findMentions } from './webmention/webmention.ts'

export const db = await Deno.openKv(Deno.env.get('DENIZEN_KV'))

export type Page<T> = { data: T[]; cursor: string }
export type PaginationOptions = {
	limit?: number
	cursor?: string
}

export const postKey = (post: Entry) => ['Post', post.iid!]
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
): Promise<Page<Entry>> => {
	// TODO: pagination options
	const list = db.list({ prefix: ['Post'] }, { limit, cursor, reverse: true })
	const res = await asyncIteratorToArray(list)
	const posts = res.map((kvEntry) => {
		const post = Entry.fromMF2Json(kvEntry.value)
		post.iid = kvEntry.key.at(-1) as string
		return post
	}).filter((post) => !post.deleted)
	return { data: posts, cursor: list.cursor }
}

export const getPost = async (iid: string): Promise<Entry | null> => {
	const kvEntry = await db.get(['Post', iid])
	if (kvEntry.value === null) return null
	const post = Entry.fromMF2Json(kvEntry.value)
	post.iid = iid
	return post
}

export const createPost = async (post: Entry): Promise<string> => {
	const myPostKey = postKey(post)
	const myUrlKey = post.uid && urlKey(post.uid)
	const tx = db.atomic()
	tx.check({ key: myPostKey, versionstamp: null })
	myUrlKey && tx.check({ key: myUrlKey, versionstamp: null })
	tx.set(myPostKey, post.toMF2Json())
	myUrlKey && tx.set(myUrlKey, post.iid)
	bump(tx)
	const { ok } = await tx.commit()
	if (!ok) throw new Error("Couldn't save post. Likely, a post with same URL or IID already exists.")

	// TODO: this doesn't feel like it belongs here
	await enqueue({
		type: 'send_webmentions',
		source: post.uid!.href,
		targets: findMentions(post),
	})
	return post.iid
}

export const updatePost = async (post: Entry): Promise<string> => {
	const oldPost = await getPost(post.iid)
	const oldContent = oldPost?.content?.html

	post.updated = new Date()

	const key = postKey(post)
	const tx = db.atomic()
	tx.set(key, post.toMF2Json())
	bump(tx)
	await tx.commit()

	// TODO: this doesn't feel like it belongs here
	await enqueue({
		type: 'send_webmentions',
		source: post.uid!.href,
		targets: findMentions(post, oldContent),
	})

	return post.iid!
}

export const deletePost = async (post: Entry) => {
	post.deleted = true
	await updatePost(post)
}

export const undeletePost = async (post: Entry) => {
	post.deleted = false
	await updatePost(post)
}

export const getPostByURL = async (url: URL): Promise<Entry | null> => {
	const kvEntry = await db.get(urlKey(url))
	if (kvEntry.value === null) return null
	return getPost(kvEntry.value as string)
}

// #endregion

// #region Webmentions

export const saveWebmention = async (post: Entry, wm: Webmention) => {
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

export const deleteWebmention = async (
	wm: { source: string; target: string },
) => {
	const srcDstKey = ['WMBySrcDst', wm.source, wm.target]
	const existing = await db.get(srcDstKey)
	if (existing.value === null) return

	const [_wm, postIid, responseType, _wmUlid] = existing.value as Deno.KvKey

	return db.atomic()
		.delete(srcDstKey)
		.delete(existing.value as Deno.KvKey)
		.sum(['WMCount', postIid], -1n)
		.sum(['WMCount', postIid, responseType], -1n)
		.commit()
}

export const getWebmentions = async (
	post: Entry,
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
	post: Entry,
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

// #endregion

// #region Config

export const getConfig = async (name: string) => {
	const res = await db.get(['Cfg', name])
	return res.value
}

export const getConfigs = async () => {
	const rv: Record<string, unknown> = {}

	const res = await db.list({ prefix: ['Cfg'] })
	for await (const { key, value } of res) rv[key[1] as string] = value

	return rv
}

export const setConfig = (name: string, value: unknown) =>
	db.set(['Cfg', name], value)

// #endregion

// #region Blog import

type BlogImportJobParams = Omit<BlogImportJob, 'id'> & Partial<BlogImportJob>

export const saveBlogImportJob = async (job: BlogImportJobParams) => {
	const key = ['ImportJob', job.id ??= ulid()]
	await db.atomic()
		.set(key, job)
		.set(['ImportJob.EntryCount', job.id], new Deno.KvU64(BigInt(job.totalPosts ?? 0n)))
		.set(['ImportJob.ImportedEntryCount', job.id], new Deno.KvU64(BigInt(job.importedPosts ?? 0n)))
		.set(['ImportJob.FailedEntryCount', job.id], new Deno.KvU64(BigInt(job.failedPosts ?? 0n)))
		.set(['ImportJob.MediaCount', job.id], new Deno.KvU64(0n))
		.set(['ImportJob.ImportedMediaCount', job.id], new Deno.KvU64(0n))
		.set(['ImportJob.FailedMediaCount', job.id], new Deno.KvU64(0n))
		.commit()
	return job as BlogImportJob
}

export const getBlogImportJob = async (id: string) => {
	const [job_, entries, imported, failed] = await db.getMany([
    ['ImportJob', id],
    ['ImportJob.EntryCount', id],
    ['ImportJob.ImportedEntryCount', id],
    ['ImportJob.FailedEntryCount', id],
	])
	console.log(job_, entries, imported, failed)
	const job = job_.value as BlogImportJob
	job.totalPosts = Number((entries.value as Deno.KvU64)?.value ?? 0)
	job.importedPosts = Number((imported.value as Deno.KvU64)?.value ?? 0)
	job.failedPosts = Number((failed.value as Deno.KvU64)?.value ?? 0)
	return job
}

export const listBlogImportJobs = async () => {
	const res = await db.list({ prefix: ['ImportJob'] })
	const jobs = []
	for await (const { value } of res) jobs.push(value as BlogImportJob)
	return jobs
}

export const recordEntryImported = (jobId: string) =>
	db.atomic()
		.sum(['ImportJob.ImportedEntryCount', jobId], 1n)
		.sum(['ImportJob.EntryCount', jobId], 2n ** 64n - 1n)
		.commit()

export const recordEntryImportFailed = (jobId: string) =>
	db.atomic()
		.sum(['ImportJob.FailedEntryCount', jobId, 'failed'], 1n)
		.sum(['ImportJob.EntryCount', jobId], 2n ** 64n - 1n)
		.commit()

export const recordMediaToImport = (jobId: string) =>
	db.atomic()
		.sum(['ImportJob.MediaCount', jobId], 1n)
		.commit()

export const recordMediaImported = (jobId: string) =>
	db.atomic()
		.sum(['ImportJob.ImportedMediaCount', jobId], 1n)
		.sum(['ImportJob.MediaCount', jobId], 2n ** 64n - 1n)
		.commit()

export const recordMediaImportFailed = (jobId: string) =>
	db.atomic()
		.sum(['ImportJob.FailedMediaCount', jobId, 'failed'], 1n)
		.sum(['ImportJob.MediaCount', jobId], 2n ** 64n - 1n)
		.commit()

// #endregion
