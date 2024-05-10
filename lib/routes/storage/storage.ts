import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'

export const get = async (c: hono.Context<Env>) => {
	const filename = c.req.param('filename')
	if (!filename) return c.body('', 400)
	try {
		const { blob, cacheControl } = await c.var.storage.read(filename)
		return c.body(blob.stream(), 200, {
			'Content-Type': blob.type,
			'Cache-Control': cacheControl,
		})
	} catch {
		return c.body('', 404)
	}
}

export const post = async (c: hono.Context<Env>) => {
	const filename = c.req.param('filename')
	const cacheControl = c.req.query('cache-control') ?? 'no-cache'

	await c.var.storage.write(filename, await c.req.blob(), { cacheControl })
	return c.redirect('/.denizen/files')
}

export const postFormdata = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()
	const cacheControlValue = formdata.get('cache-control')
	const cacheControl = typeof cacheControlValue === 'string'
		? cacheControlValue
		: 'no-cache'

	const file = formdata.get('file')
	if (!file || !(file instanceof File)) return c.body('No file!', 400)
	await c.var.storage.write(file.name, file, { cacheControl })
	return c.redirect('/.denizen/files')
}

export const del = async (c: hono.Context<Env>) => {
	const filename = c.req.param('filename')
	if (!filename) return c.body('', 400)
	try {
		await c.var.storage.del(filename)
		return c.body('', 200)
	} catch {
		return c.body('', 404)
	}
}

export const queryParam = (c: hono.Context<Env>) => {
	const queries = c.req.query()
	const filename = queries['filename']
	if (!filename) return c.body('', 400)
	delete queries['filename']
	return c.redirect(
		'/.denizen/storage/' + encodeURIComponent(filename) + '?' +
			new URLSearchParams(queries),
		308,
	)
}
