import * as hono from '../deps/hono.ts'
import render from './common/vento.ts'
import type { Env } from './denizen.ts'

export const get = (c: hono.Context<Env>) => {
	if (/application\/(.*\+)?json/i.test(c.req.header('Expect')!)) {
		return c.json({ error: 'not_found', http: 404 })
	}

	c.status(404)
	c.set('title', 'Not found')
	return c.var.render("404.vto")
}
