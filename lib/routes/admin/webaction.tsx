/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'

import { toScript } from '../../common/util.ts'

export const get = (c: hono.Context<Env>) =>
	c.html(toScript(() => {
		// deno-lint-ignore no-window
		if (window.parent !== window) {
			window.parent.postMessage(
				JSON.stringify({
					reply: new URL(
						'/.denizen/post/new?in-reply-to={url}',
						window.location.href,
					).href,
				}),
				'*',
			)
		}
	}))
