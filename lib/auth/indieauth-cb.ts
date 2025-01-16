import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

export const get = async (c: hono.Context<Env>) => {
	const validate = await fetch('https://indieauth.com/auth', {
		method: 'POST',
		body: new URLSearchParams({
			code: c.req.query('code')!,
			redirect_uri: new URL('/.denizen/indieauth-cb', c.var.baseUrl).href,
			client_id: c.var.baseUrl.href,
		}),
	}).then((res) => res.json())
	if (validate.me === c.var.baseUrl.href) {
		const sesh = c.get('session')
		sesh.set('user', 'admin')
		return c.redirect('/')
	} else {
		return c.var.render('login.vto', { error: 'IndieAuth login failed' })
	}
}
