// TODO: Rewrite in Deno KV blob storage when that becomes a thing.

import * as path from 'jsr:@std/path@1.0.8'
import { WriteOptions } from './storage-interface.ts'

export const name = 'FSBackend'

export const read = async (
  name: string,
): Promise<{ blob: Blob; cacheControl: string }> => ({
  blob: new Blob([await Deno.readFile(encode(name))], {
    type: await Deno.readTextFile(encode(name) + '.#type'),
  }),
  cacheControl: await Deno.readTextFile(encode(name) + '.#cache-control'),
})

export const write = async (
  name: string,
  content: Blob | ReadableStream<Uint8Array>,
  { cacheControl, contentType }: WriteOptions,
): Promise<void> => {
  await Deno.mkdir(blobDir, { recursive: true })
  await Deno.writeTextFile(
    encode(name) + '.#type',
    contentType ??
      (content instanceof Blob ? content.type : 'application/octet-stream'),
  )
  await Deno.writeTextFile(encode(name) + '.#cache-control', cacheControl)
  return Deno.writeFile(
    encode(name),
    content instanceof Blob ? content.stream() : content,
  )
}

export const list = async function* () {
  await Deno.mkdir(blobDir, { recursive: true })
  for await (const entry of Deno.readDir(blobDir)) {
    if (entry.name.endsWith('.#type')) continue
    if (entry.name.endsWith('.#cache-control')) continue
    yield decodeURIComponent(entry.name)
  }
}

export const del = (name: string) => Deno.remove(encode(name))

const blobDir = Deno.env.get('DENIZEN_BLOBS') ?? '_blobs'

const encode = (s: string) => path.join(blobDir, encodeURIComponent(s))
