/** @jsx jsx */
/** @jsxFrag Fragment */

import { FC, Fragment, html, jsx } from '../deps/hono.ts'

import { Post } from './model.ts'

import * as config from '../config.ts'
import { Page } from './db.ts'
import { type User } from './auth.tsx'

export const Layout: FC<{
	lang?: string
	title: string
}> = (p) =>
	html`
<!doctype html>
<html lang="${p.lang ?? config.locales[0]}">
<meta charset=utf-8 name=viewport content=width=device-width>
<title>${p.title}</title>
<link rel=stylesheet href="https://rsms.me/inter/inter.css">
<link rel=stylesheet href="/.denizen/public/style.css">
<script src="https://unpkg.com/htmx.org@1.9.6" integrity="sha384-FhXw7b6AlE/jyjlZH5iHa/tTe9EpJ1Y55RjcgPbjeWMskSxZt1v9qkxLJWNJaGni" crossorigin="anonymous"></script>
<link rel=alternate type=application/feed+json href=/feed.json>
${p.children}
`
