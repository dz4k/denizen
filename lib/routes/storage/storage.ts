import * as hono from '../../../deps/hono.ts'
import { Env } from '../../server.tsx'

import * as storage from '../../storage.ts'

export const get = async (c: hono.Context<Env>) => {
	const filename = c.req.param('filename')
	if (!filename) return c.body('', 400)
	try {
		const blob = await storage.read(filename)
		console.log(blob)
		return c.body(blob.stream(), 200, {
			'Content-Type': blob.type,
		})
	} catch {
		return c.body('', 404)
	}
}

export const post = async (c: hono.Context<Env>) => {
	const filename = c.req.param('filename')

	await storage.write(filename, await c.req.blob())
	return c.redirect('/.denizen/files')
}

export const postFormdata = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()

	const file = formdata.get('file')
	if (!file || !(file instanceof File)) return c.body('No file!', 400)
	await storage.write(file.name, file)
	return c.redirect('/.denizen/files')
}

export const del = async (c: hono.Context<Env>) => {
	const filename = c.req.param('filename')
	if (!filename) return c.body('', 400)
	try {
		await storage.del(filename)
		return c.body('', 200)
	} catch {
		return c.body('', 404)
	}
}

export const queryParam = (c: hono.Context<Env>) => {
	const filename = c.req.query('filename')
	if (!filename) return c.body('', 400)
	return c.redirect('/.denizen/storage/' + encodeURIComponent(filename), 308)
}
