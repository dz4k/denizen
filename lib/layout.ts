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

<link rel=stylesheet href="/.denizen/public/style.css">
<link rel=stylesheet href="/.denizen/public/theme-${p.theme}.css">

<script>
// https://codeberg.org/dz4k/js4k/src/commit/4c80b8f8ec78f347559a4f21be8262dcf0d8e67d/lib/soiree.js
const e=(e,t,r)=>{if(!t)return;let a=[...t.relList].find(e=>e.startsWith("swap"));if(!a)return;e.preventDefault();let n=t.target?t.getRootNode().querySelector(t.target):t,s=a.slice(5)||"replaceChildren",i=r(t);i.headers.set("soiree","1"),fetch(i).then(e=>e.text()).then(e=>n?.[s](document.createRange().createContextualFragment(e)))};addEventListener("click",t=>e(t,t.target.closest("a"),e=>e.href)),addEventListener("submit",t=>e(t,t.target,e=>new Request(e.action,{method:e.getAttribute("method")||"GET",body:new FormData(e)})));
</script>

<link rel=alternate type=application/feed+json href=/feed.json>

<link rel=authorization_endpoint href="https://indieauth.com/auth">
<link rel=token_endpoint href="https://tokens.indieauth.com/token">

<link rel=micropub href="/.denizen/micropub">

<link rel=webmention href="/.denizen/webmention">

${p.children}
`
