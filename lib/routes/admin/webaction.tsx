/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

export const get = (c: hono.Context<Env>) =>
	c.html(
		<Layout theme={c.var.theme} title='Web actions'>
			<h1>Web+Action handler</h1>
			<script src='/.denizen/public/webaction-receiver.js' type='module' />
		</Layout>,
	)
