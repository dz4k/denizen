import * as hono from '../../../deps/hono.ts'
import { Env } from '../../server.tsx'

export const get = (c: hono.Context<Env>) =>
	c.redirect('https://youtube.com/watch?v=dQw4w9WgXcQ')
