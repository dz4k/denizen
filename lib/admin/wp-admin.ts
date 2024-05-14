import * as hono from '../../deps/hono.ts'
import { clientRedirect } from '../common/util.ts'
import type { Env } from '../denizen.ts'

export const get = (c: hono.Context<Env>) =>
	c.html(clientRedirect('https://youtube.com/watch?v=dQw4w9WgXcQ'))
