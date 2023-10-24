import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'

export const get = (c: hono.Context<Env>) =>
	c.redirect('https://youtube.com/watch?v=dQw4w9WgXcQ')
