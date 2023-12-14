import { FC, html } from '../deps/hono.ts'

import * as config from './config.ts'

export const Layout: FC<{
	lang?: string
	title: string
	theme: string
}> = (p) =>
	html`
<!doctype html>
<html lang="${p.lang ?? config.lang}">
<meta charset=utf-8 name=viewport content=width=device-width>

<title>${p.title}</title>

<link rel=stylesheet href="https://rsms.me/inter/inter.css">
<link rel=stylesheet href="/.denizen/public/style.css">
<link rel=stylesheet href="/.denizen/public/theme-${p.theme}.css">

<script type="module">
	import whet from "/.denizen/public/whet.remote.js"
	whet()
</script>

<link rel=alternate type=application/feed+json href=/feed.json>

<link rel=authorization_endpoint href="https://indieauth.com/auth">
<link rel=token_endpoint href="https://tokens.indieauth.com/token">

<link rel=micropub href="/.denizen/micropub">

<link rel=webmention href="/.denizen/webmention">

${p.children}
`
