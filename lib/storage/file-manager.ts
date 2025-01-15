import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { asyncIteratorToArray } from '../common/util.ts'

export const get = async (c: hono.Context<Env>) => {
	const files = await asyncIteratorToArray(c.var.storage.list())
	return c.var.render('file-manager.vto', { files })
}
