import type * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { toScript } from '../common/util.ts'

export const get = (c: hono.Context<Env>) =>
  c.html(toScript(() => {
    // @ts-ignore Client-side code
    if (parent !== window) {
      // @ts-ignore Client-side code
      parent.postMessage(
        JSON.stringify({
          reply: new URL(
            '/.denizen/post/new?in-reply-to={url}',
            location.href,
          ).href,
        }),
        '*',
      )
    }
  }))
