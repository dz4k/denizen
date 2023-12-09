// TODO: Rewrite in Deno KV blob storage when that becomes a thing.

import * as path from 'https://deno.land/std@0.203.0/path/mod.ts'

export const name = 'FSBackend'

export const read = async (name: string): Promise<Blob> =>
	new Blob([await Deno.readFile(encode(name))], {
		type: await Deno.readTextFile(encode(name) + '.#type'),
	})

export const write = async (name: string, blob: Blob): Promise<void> => {
	await Deno.mkdir(blobDir, { recursive: true })
	await Deno.writeTextFile(encode(name) + '.#type', blob.type)
	return Deno.writeFile(encode(name), blob.stream())
}
export const list = async function* () {
	await Deno.mkdir(blobDir, { recursive: true })
	for await (const entry of Deno.readDir(blobDir)) {
		if (entry.name.endsWith('.#type')) continue
		yield decodeURIComponent(entry.name)
	}
}
export const del = (name: string) => Deno.remove(encode(name))

const blobDir = '_blobs'
const encode = (s: string) => path.join(blobDir, encodeURIComponent(s))
