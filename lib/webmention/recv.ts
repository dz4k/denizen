import { assert } from 'jsr:@std/assert@1.0.10/assert'

import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { enqueue } from '../queue.ts'

const supportedSchemes = new Set(['http:', 'https:'])

export const post = async (c: hono.Context<Env>) => {
  const { source, target } = await c.req.parseBody()
  if (typeof source !== 'string' || typeof target !== 'string') {
    return c.json({ error: 'bad_request' }, 400)
  }

  // Validate URLs
  try {
    const sourceUrl = new URL(source.toString())
    assert(supportedSchemes.has(sourceUrl.protocol))
  } catch {
    return c.json({ error: 'invalid_source' }, 400)
  }
  try {
    const targetUrl = new URL(target.toString())
    assert(supportedSchemes.has(targetUrl.protocol))
    assert(targetUrl.host === c.var.baseUrl.host)
  } catch {
    return c.json({ error: 'invalid_target' }, 400)
  }

  // Reject self mentions
  if (source === target) {
    return c.json({ error: 'source_same_as_target' }, 400)
  }

  // Enqueue mention
  await enqueue({ type: 'recv_webmention', source, target })

  return c.body(null, 202)
}
