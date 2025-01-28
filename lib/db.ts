import { Entry } from './model/entry.ts'
import { Webmention, WMResponseType } from './model/webmention.ts'
import { asyncIteratorToArray } from './common/util.ts'
import { User } from './model/user.ts'
import { ulid } from 'jsr:@std/ulid@1.0.0'
import { enqueue } from './queue.ts'
import type { BlogImportJob } from './import-blog.ts'
import { findMentions } from './webmention/webmention.ts'

export const db = await Deno.openKv(Deno.env.get('DENIZEN_KV'))

export type Page<T> = { data: T[]; cursor: string }
export type PaginationOptions = {
  limit?: number
  cursor?: string
}

export const entryKey = (entry: Entry) => ['Post', entry.iid!]
export const urlKey = (url: URL) => ['PostURL', url.pathname]
export const lastmodKey = ['Last modified']

export const lastMod = async () => {
  const res = await db.get(lastmodKey)
  return res.value as number ?? 0
}

export const bump = (tx: Deno.AtomicOperation) => tx.set(lastmodKey, Date.now())

// #region Entries

export const getEntries = async (
  { limit = 100, cursor }: PaginationOptions = {},
): Promise<Page<Entry>> => {
  // TODO: pagination options
  const list = db.list({ prefix: ['Post'] }, { limit, cursor, reverse: true })
  const res = await asyncIteratorToArray(list)
  const entries = res.map((kvEntry) => {
    const entry = Entry.fromMF2Json(kvEntry.value)
    entry.iid = kvEntry.key.at(-1) as string
    return entry
  }).filter((entry) => !entry.deleted)
  return { data: entries, cursor: list.cursor }
}

export const getEntry = async (iid: string): Promise<Entry | null> => {
  const kvEntry = await db.get(['Post', iid])
  if (kvEntry.value === null) return null
  const entry = Entry.fromMF2Json(kvEntry.value)
  entry.iid = iid
  return entry
}

export const createEntry = async (entry: Entry): Promise<string> => {
  const myEntryKey = entryKey(entry)
  const myUrlKey = entry.uid && urlKey(entry.uid)
  const tx = db.atomic()
  tx.check({ key: myEntryKey, versionstamp: null })
  myUrlKey && tx.check({ key: myUrlKey, versionstamp: null })
  tx.set(myEntryKey, entry.toMF2Json())
  myUrlKey && tx.set(myUrlKey, entry.iid)
  bump(tx)
  const { ok } = await tx.commit()
  if (!ok) {
    throw new Error(
      "Couldn't save entry. Likely, an entry with same URL or IID already exists.",
    )
  }

  // TODO: this doesn't feel like it belongs here
  await enqueue({
    type: 'send_webmentions',
    source: entry.uid!.href,
    targets: findMentions(entry),
  })
  return entry.iid
}

export const updateEntry = async (entry: Entry): Promise<string> => {
  const oldEntry = await getEntry(entry.iid)
  const oldContent = oldEntry.content?.html

  entry.updated = new Date()

  const key = entryKey(entry)
  const tx = db.atomic()
  tx.set(key, entry.toMF2Json())
  bump(tx)
  await tx.commit()

  // TODO: this doesn't feel like it belongs here
  await enqueue({
    type: 'send_webmentions',
    source: entry.uid!.href,
    targets: findMentions(entry, oldContent),
  })

  await purgeEntryFromCache(entry)

  return entry.iid!
}

export const deleteEntry = async (entry: Entry) => {
  entry.deleted = true
  await updateEntry(entry)
}

export const undeleteEntry = async (entry: Entry) => {
  entry.deleted = false
  await updateEntry(entry)
}

export const getEntryByURL = async (url: URL): Promise<Entry | null> => {
  const kvEntry = await db.get(urlKey(url))
  if (kvEntry.value === null) return null
  return getEntry(kvEntry.value as string)
}

const purgeEntryFromCache = async (entry: Entry) => {
  const cache = await caches.open('denizen-request-cache')
  return cache.delete(entry.uid!)
}

// #endregion

// #region Webmentions

export const saveWebmention = async (entry: Entry, wm: Webmention) => {
  const srcDstKey = ['WMBySrcDst', wm.source, wm.target]
  const existing = await db.get(srcDstKey)
  if (existing.value) {
    return db.atomic()
      .set(existing.value as Deno.KvKey, wm.serialize())
      .commit()
  }
  const iid = [
    'WM',
    entry.iid,
    wm.responseType,
    ulid(),
  ]
  return db.atomic()
    .check({ key: srcDstKey, versionstamp: existing.versionstamp })
    .set(srcDstKey, iid)
    .set(iid, wm.serialize())
    .sum(['WMCount', entry.iid], 1n)
    .sum(['WMCount', entry.iid, wm.responseType], 1n)
    .commit()
}

export const deleteWebmention = async (
  wm: { source: string; target: string },
) => {
  const srcDstKey = ['WMBySrcDst', wm.source, wm.target]
  const existing = await db.get(srcDstKey)
  if (existing.value === null) return

  const [_wm, entryIid, responseType, _wmUlid] = existing.value as Deno.KvKey

  return db.atomic()
    .delete(srcDstKey)
    .delete(existing.value as Deno.KvKey)
    .sum(['WMCount', entryIid], 2n ** 64n - 1n)
    .sum(['WMCount', entryIid, responseType], 2n ** 64n - 1n)
    .commit()
}

export const getWebmentions = async (
  entry: Entry,
  type: WMResponseType,
  options: PaginationOptions = {},
): Promise<Page<Webmention>> => {
  const list = db.list({ prefix: ['WM', entry.iid, type] }, {
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
  entry: Entry,
  type: WMResponseType,
) => (await db.get(['WMCount', entry.iid, type])).value ?? 0

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
    .set(
      ['ImportJob.EntryCount', job.id],
      new Deno.KvU64(BigInt(job.entriesTotal ?? 0n)),
    )
    .set(
      ['ImportJob.ImportedEntryCount', job.id],
      new Deno.KvU64(BigInt(job.entriesImported ?? 0n)),
    )
    .set(
      ['ImportJob.FailedEntryCount', job.id],
      new Deno.KvU64(BigInt(job.entriesFailed ?? 0n)),
    )
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
  job.entriesTotal = Number((entries.value as Deno.KvU64)?.value ?? 0)
  job.entriesImported = Number((imported.value as Deno.KvU64)?.value ?? 0)
  job.entriesFailed = Number((failed.value as Deno.KvU64)?.value ?? 0)
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
