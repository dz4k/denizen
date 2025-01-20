import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'
import vento, { fragments } from '../../deps/vento.ts'

const vto = vento({
  autoescape: true,
  includes: import.meta.dirname + '/../views',
})
vto.use(fragments())

const render = async (
  c: hono.Context<Env>,
  template: string,
  data?: Record<string, unknown>,
) => {
  const path = template
  const res = await vto.run(path, { ...data, c })
  return res.content
}

export default render
