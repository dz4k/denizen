import * as hono from '../../../deps/hono.ts'
import { Env } from '../../server.tsx'

import { decodeBase64 } from 'https://deno.land/std@0.203.0/encoding/base64.ts'
import { contentType } from 'https://deno.land/std@0.203.0/media_types/content_type.ts'
import * as path from 'https://deno.land/std@0.203.0/path/mod.ts'

import assets from '../../../build/assets.json' assert { type: 'json' }

export const get = (c: hono.Context<Env>) => {
	const name = c.req.param('asset')
	if (!(name in assets)) return c.notFound()
	c.header('Content-Type', contentType(path.extname(name)))
	return c.body(decodeBase64(assets[name as keyof typeof assets]))
}
