/** @jsx hono.h */
/** @jsxFrag hono.fragment */

import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'
import { Layout } from '../layout.ts'

export const get = (c: hono.Context<Env>) => {
	if (/application\/(.*\+)?json/i.test(c.req.header('Expect')!)) {
		return c.json({ error: 'not_found', http: 404 })
	}
	return c.html(
		<Layout title='Not found'>
			<main>
				<h1>Page not found</h1>
				<p>HTTP 404</p>
			</main>
		</Layout>,
	)
}
