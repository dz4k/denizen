import { FC, html, useRequestContext } from '../deps/hono.ts'

import { Env } from './denizen.ts'

export const Layout: FC = (p) => {
	const c = useRequestContext<Env>()
	return html`
<!doctype html>
<html lang="${c.var.lang}">
<meta charset=utf-8 name=viewport content=width=device-width>

<title>${c.var.title}</title>

<link rel=stylesheet href="/.denizen/public/style.css">
<link rel=stylesheet href="/.denizen/public/theme-${c.var.theme}.css">

<script src="/.denizen/public/webaction-button.js"></script>
<script>
// https://codeberg.org/dz4k/js4k/src/commit/4c80b8f8ec78f347559a4f21be8262dcf0d8e67d/lib/soiree.js
const e=(e,t,r)=>{if(!t)return;let a=[...t.relList].find(e=>e.startsWith("swap"));if(!a)return;e.preventDefault();let n=t.target?t.getRootNode().querySelector(t.target):t,s=a.slice(5)||"replaceChildren",i=r(t);i.headers.set("soiree","1"),fetch(i).then(e=>e.text()).then(e=>n?.[s](document.createRange().createContextualFragment(e)))};addEventListener("click",t=>e(t,t.target.closest("a"),e=>e.href)),addEventListener("submit",t=>e(t,t.target,e=>new Request(e.action,{method:e.getAttribute("method")||"GET",body:new FormData(e)})));
</script>

<link rel=alternate type=application/feed+json href=/feed.json>

<link rel=indieauth-metadata href="/.well-known/oauth-authorization-server">
<link rel=authorization_endpoint href="/.denizen/auth">
<link rel=token_endpoint href="/.denizen/token">

<link rel=micropub href="/.denizen/micropub">

<link rel=webmention href="/.denizen/webmention">

${p.children}
`
}
