import { escape as htmlEscape } from 'jsr:@std/html@1.0.3'
import {
  createPost,
  getPost,
  recordEntryImported,
  recordEntryImportFailed,
  recordMediaImported,
  recordMediaImportFailed,
  recordMediaToImport,
  saveBlogImportJob,
  updatePost,
} from './db.ts'
import { Entry } from './model/entry.ts'
import { Card } from './model/card.ts'
import { enqueue } from './queue.ts'
import parseMicroformats from './mf2/mf2-parser.ts'
import { Document, DOMParser, Element } from '../deps/dom.ts'
import * as storage from './storage/fs-backend.ts'
import * as config from './config.ts'

export type BlogImportJob = {
  id: string
  feedUrl: string
  status: 'starting' | 'running' | 'failed'

  totalPosts?: number
  importedPosts?: number
  failedPosts?: number

  errors?: string[]
}

export const importBlog = async (job: BlogImportJob) => {
  if (job.status !== 'starting') {
    console.error(
      `importBlog: Job ${job.id} is already ongoing (status: ${job.status}, expected 'starting')`,
    )
    return
  }

  job.status = 'running'
  await saveBlogImportJob(job)

  // Fetch the feed
  const res = await fetch(job.feedUrl, {
    headers: {
      'Accept': 'application/feed+json, application/json',
      'User-Agent': config.userAgent,
    },
  })
  if (!res.ok) {
    await failJob(
      job,
      `Failed to fetch ${job.feedUrl}: ${res.status} ${res.statusText}`,
    )
    return
  }

  // Parse the feed
  // TODO: support paginated feeds
  const contentType = res.headers.get('Content-Type')
  let entries: Entry[]
  if (
    contentType === 'application/feed+json' ||
    contentType === 'application/json'
  ) {
    entries = await parseJsonFeed(res)
  } else {
    await failJob(job, `Unsupported feed type: ${contentType}`)
    return
  }

  // Save entry count
  job.totalPosts = entries.length
  await saveBlogImportJob(job)

  // Save the entries
  for (const entry of entries) {
    entry.deleted = true
    const iid = await createPost(entry)
    await enqueue({
      type: 'import_entry',
      jobId: job.id,
      entryId: iid,
    })
  }
}

export const importEntry = async (jobId: string, entryId: string) => {
  const entry = await getPost(entryId)
  if (!entry) throw new Error(`importEntry: Entry not found: ${entryId}`)
  try {
    await importEntryImpl(jobId, entry)
    await recordEntryImported(jobId)
  } catch (e) {
    console.error(`importEntry: ${e}`)
    await recordEntryImportFailed(jobId)
  }
}

const importEntryImpl = async (jobId: string, entry: Entry) => {
  const entryUrl = entry.uid!
  console.log(`importEntry: ${entryUrl}`)

  // Fill in missing content
  if (!entry.content) {
    const res = await fetch(entryUrl, {
      headers: { 'User-Agent': config.userAgent },
    })
    if (!res.ok) {
      throw new Error(
        `importEntry: Failed to fetch ${entry.url}: ${res.status} ${res.statusText}`,
      )
    }

    const html = await res.text()
    entry.content = { html }
  }

  // TODO: more heuristics for extracting content
  if (/<!doctype html/i.test(entry.content!.html)) {
    const mf2 = parseMicroformats(entry.content!.html, {
      baseUrl: entryUrl.href,
    })
    const hEntry = mf2.items.find((i) => i.type.includes('h-entry'))
    if (hEntry) {
      entry.add(hEntry.properties)
      entry.replace({ content: hEntry.properties.content })
    } else {
      const document = new DOMParser().parseFromString(
        entry.content!.html,
        'text/html',
      )!
      entry.content = {
        html: document.querySelector(
          'main, [id^="post-content"], .e-content, .post-content, .content',
        )!.innerHTML,
      }
    }
  }

  // Find media
  const div = new Document().createElement('div')
  div.innerHTML = entry.content!.html

  const media = new Map<string, string>() // Map from old URLs to new filenames
  div.querySelectorAll('img, video, audio').forEach((n) => {
    const el = n as Element
    const src = el.getAttribute('src')
    if (src) {
      const url = new URL(src, entryUrl)
      const newName = crypto.randomUUID()
      media.set(url.href, newName)
      el.setAttribute('src', `/.denizen/storage/${newName}`)
    }
  })

  entry.content!.html = div.innerHTML

  // Upload media
  for (const [oldUrl, newUrl] of media) {
    await recordMediaToImport(jobId)
    await enqueue({
      type: 'import_media',
      jobId,
      oldUrl,
      newUrl,
    })
  }

  // Save the post
  entry.deleted = false
  await updatePost(entry)
}

export const importMedia = async (
  jobId: string,
  oldUrl: string,
  newUrl: string,
) => {
  try {
    await importMediaImpl(jobId, oldUrl, newUrl)
    await recordMediaImported(jobId)
  } catch (e) {
    console.error(`importMedia: ${e}`)
    await recordMediaImportFailed(jobId)
  }
}

const importMediaImpl = async (
  jobId: string,
  oldUrl: string,
  newUrl: string,
) => {
  console.log(`importMedia: ${oldUrl} -> ${newUrl}`)
  const res = await fetch(oldUrl, {
    headers: { 'User-Agent': config.userAgent },
  })
  if (!res.ok) {
    throw new Error(
      `Failed to fetch ${oldUrl}: ${res.status} ${res.statusText}`,
    )
  }
  await storage.write(
    newUrl,
    res.body!,
    {
      cacheControl: res.headers.get('Cache-Control') ??
        'public, max-age=31536000',
      contentType: res.headers.get('Content-Type') ?? undefined,
    },
  )
  await recordMediaImported(jobId)
}

const failJob = async (job: BlogImportJob, error: string) => {
  console.error(`importBlog: Job ${job.id} failed: ${error}`)
  job.status = 'failed'
  ;(job.errors ??= []).push(error)
  await saveBlogImportJob(job)
}

type JSONFeedItem = {
  url: string
  title: string
  content_html?: string
  content_text?: string
  date_published: string
  date_modified?: string
  summary?: string
  image?: string
  authors?: { name: string; url?: string; avatar?: string }[]
  tags?: string[]
  language?: string
}

const parseJsonFeed = async (res: Response): Promise<Entry[]> => {
  const feed = await res.json()
  return feed.items.map((item: JSONFeedItem) =>
    new Entry({
      uid: new URL(item.url),
      name: item.title,
      content: item.content_html
        ? { html: item.content_html, lang: item.language }
        : {
          html: htmlEscape(item.content_text!),
          value: item.content_text,
          lang: item.language,
        },
      published: new Date(item.date_published),
      updated: item.date_modified ? new Date(item.date_modified) : undefined,
      summary: item.summary,
      photo: item.image ? [{ url: new URL(item.image, res.url) }] : [],
      author: item.authors?.map((a) =>
        new Card(a.name, {
          url: a.url ? [new URL(a.url)] : [],
          photo: a.avatar ? [{ url: new URL(a.avatar) }] : [],
        })
      ) ?? [],
      category: item.tags ?? [],
    })
  )
}
