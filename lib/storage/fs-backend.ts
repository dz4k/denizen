// TODO: Rewrite in Deno KV blob storage when that becomes a thing.

import * as path from 'https://deno.land/std@0.203.0/path/mod.ts'

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
	blob: Blob,
	cacheControl: string,
): Promise<void> => {
	await Deno.mkdir(blobDir, { recursive: true })
	await Deno.writeTextFile(encode(name) + '.#type', blob.type)
	await Deno.writeTextFile(encode(name) + '.#cache-control', cacheControl)
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

const blobDir = Deno.env.get('DENIZEN_BLOBS') ?? '_blobs'

const encode = (s: string) => path.join(blobDir, encodeURIComponent(s))
