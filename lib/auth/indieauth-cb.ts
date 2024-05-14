import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import * as config from '../config.ts'
import { LoginForm } from './_login-form.tsx'

export const get = async (c: hono.Context<Env>) => {
	const validate = await fetch('https://indieauth.com/auth', {
		method: 'POST',
		body: new URLSearchParams({
			code: c.req.query('code')!,
			redirect_uri: new URL('/.denizen/indieauth-cb', config.baseUrl).href,
			client_id: config.baseUrl.href,
		}),
	}).then((res) => res.json())
	if (validate.me === config.baseUrl.href) {
		const sesh = c.get('session')
		sesh.set('user', 'admin')
		return c.redirect('/')
	} else {
		return c.html(
			LoginForm({ error: 'IndieAuth login failed', theme: c.var.theme }),
			401,
		)
	}
}
