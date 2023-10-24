import { Context, MiddlewareHandler } from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'

export const isAdmin = (c: Context<Env>) =>
	c.var.session.get('user') === 'admin'

export const requireAdmin: MiddlewareHandler<Env> = async (c, next) => {
	if (!isAdmin(c)) {
		if (c.req.method === 'GET') return c.redirect('/.denizen/login', 303)
		else return c.status(401)
	} else await next()
}
