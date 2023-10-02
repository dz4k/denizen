/** @jsx jsx */
/** @jsxFrag Fragment */

import { FC, Fragment, html, jsx } from '../deps/hono.ts'

import { Post } from './model.ts'

import * as config from '../config.ts'
import { Page } from './db.ts'

const Layout: FC<{
	lang?: string
	title: string
}> = (p) =>
	html`
<!doctype html>
<html lang="${p.lang ?? config.locales[0]}">
<meta charset=utf-8 name=viewport content=width=device-width>
<title>${p.title}</title>
<link rel=stylesheet href="${config.stylesheet}">
${p.children}
`

export const HomePage = (p: {
	posts: Page<Post>
}) => (
	<Layout title={config.siteName}>
		<header>
			<h1>
				<a href='/'>{config.siteName}</a>
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
			<p>
				<a href='/post/new'>New Post</a>
			</p>
		</footer>
	</Layout>
)

export const PostPage = (p: {
	post: Post
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

export const PostEditor = () => (
	<Layout title='New Post'>
		<header>
			<h1>New Post</h1>
		</header>
		<main>
			<script type='module' src='/public/post-editor.js'></script>
			<post-editor></post-editor>
		</main>
	</Layout>
)
