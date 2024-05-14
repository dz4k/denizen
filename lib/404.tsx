import * as hono from '../deps/hono.ts'
import type { Env } from './denizen.ts'
import { Layout } from './layout.ts'

export const get = (c: hono.Context<Env>) => {
	if (/application\/(.*\+)?json/i.test(c.req.header('Expect')!)) {
		return c.json({ error: 'not_found', http: 404 })
	}
	return c.html(
		<Layout title='Not found' theme={c.var.theme}>
			<main>
				<h1>HTTP 404</h1>
				<p>There's nothing here... and never was.</p>
				<p>
					<a href='/'>&gt; Go back home.</a>
				</p>
			</main>
		</Layout>,
		404,
	)
}
