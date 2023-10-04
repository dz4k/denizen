/** @jsx jsx */
/** @jsxFrag Fragment */

import { FC, Fragment, html, jsx } from '../deps/hono.ts'

import { Post } from './model.ts'

import * as config from '../config.ts'
import { Page } from './db.ts'
import { User } from './auth.tsx'

export const Layout: FC<{
	lang?: string
	title: string
}> = (p) =>
	html`
<!doctype html>
<html lang="${p.lang ?? config.locales[0]}">
<meta charset=utf-8 name=viewport content=width=device-width>
<title>${p.title}</title>
<link rel=stylesheet href="${config.stylesheet}">
<script src="https://unpkg.com/htmx.org@1.9.6" integrity="sha384-FhXw7b6AlE/jyjlZH5iHa/tTe9EpJ1Y55RjcgPbjeWMskSxZt1v9qkxLJWNJaGni" crossorigin="anonymous"></script>
${p.children}
`

export const HomePage = (p: {
	posts: Page<Post>
	admin: boolean
	user: User
}) => (
	<Layout title={p.user.profile.name}>
		<header>
			<h1>
				<a href='/'>{p.user.profile.name}</a>
			</h1>
		</header>
		<main>
			{p.posts.data.map((post) => (
				<article class='h-entry margin-block padding-block'>
					<h2>
						<a class='p-name u-url u-uid' href={post.uid.pathname}>
							{post.name}
						</a>
					</h2>
					<p>
						<time className='dt-published'>
							{post.published.toLocaleString(config.locales)}
						</time>
						{post.updated && (
							<>
								{' '}&middot; Updated on{' '}
								<time className='dt-updated'>
									{post.updated.toLocaleString(config.locales)}
								</time>
							</>
						)}
					</p>
					{post.summary
						? (
							<p
								class='italic'
								dangerouslySetInnerHTML={{ __html: post.summary }}
							/>
						)
						: ''}
				</article>
			))}
			{p.posts.cursor
				? (
					<a
						rel='next'
						href={'/?cursor=' + encodeURIComponent(p.posts.cursor)}
						hx-boost
						hx-select='main :is(.h-entry, [rel=next])'
					>
						Load more
					</a>
				)
				: ''}
		</main>
		<footer>
			{p.admin
				? (
					<div class='margin-block f-row align-items:center'>
						<a class="<button>" href='/.denizen/post/new'>New Post</a>
						<form method='POST' action='/.denizen/auth/logout' class='contents'>
							<button>Logout</button>
						</form>
					</div>
				)
				: ''}
		</footer>
	</Layout>
)

export const PostPage = (p: {
	post: Post,
	admin: boolean
}) => (
	<Layout title={p.post.name ?? config.siteName}>
		<article class='h-entry'>
			<header class='container padding-block-start'>
				{p.post.name ? <h1 class='p-name'>{p.post.name}</h1> : ''}
				{p.post.summary
					? (
						<p
							class='big italic'
							dangerouslySetInnerHTML={{ __html: p.post.summary }}
						/>
					)
					: ''}
				<p>
					<a href={p.post.uid} class='u-url u-uid'>
						<time class='dt-published'>
							{p.post.published.toLocaleString(config.locales)}
						</time>
					</a>
				</p>
				{p.post.updated
					? <p>Updated on {p.post.updated.toLocaleString(config.locales)}</p>
					: ''}
			</header>
			<main
				class='e-content'
				dangerouslySetInnerHTML={{ __html: p.post.content }}
			>
			</main>
			<footer>
				{p.admin
					? (
						<div class='margin-block f-row align-items:center'>
							<form hx-delete={p.post.uid.pathname} class='contents'>
								<button>Delete</button>
							</form>
						</div>
					)
					: ''}
			</footer>
		</article>
	</Layout>
)

export const FourOhFour = () => (
	<Layout title='="Not found'>
		<main>
			<h1>Page not found</h1>
			<p>HTTP 404</p>
		</main>
	</Layout>
)

export const PostDeleted = () => (
	<Layout title='Deleted post'>
		<main>
			<p>
				There's nothing here... but there might have been.
			</p>
			<p>
				<a href="/">&gt; Go back home.</a>
			</p>
		</main>
	</Layout>
)
