// TODO: Rewrite in Deno KV blob storage when that becomes a thing.

import * as path from 'https://deno.land/std/path/mod.ts'

export const read = async (name: string): Promise<Blob> =>
	new Blob([await Deno.readFile(encode(name))])

export const write = async (name: string, blob: Blob): Promise<void> => {
    await Deno.mkdir(blobDir, { recursive: true })
    return Deno.writeFile(encode(name), blob.stream())
}
export const list = async function* () {
    await Deno.mkdir(blobDir, { recursive: true })
	for await (const entry of Deno.readDir(blobDir)) {
		yield decodeURIComponent(entry.name)
	}
}
export const del = (name: string) => Deno.remove(encode(name))

const blobDir = '_blobs'
const encode = (s: string) => path.join(blobDir, encodeURIComponent(s))
