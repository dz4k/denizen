/** @jsx hono.h */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import { Layout } from '../../layout.ts'

import * as config from '../../config.ts'

export const LoginForm = (p: { error?: string }) => (
	<Layout title='Login -- Denizen'>
		<header>
			<h1>Log in</h1>
		</header>
		<main>
			{p.error && <div class='bad box'>{p.error}</div>}
			<form method='post' class='table rows'>
				{
					/* <p>
					<label for='edit-username'>Username</label>
					<input type='text' name='username' id='edit-username' />
				</p> */
				}
				<input type='hidden' name='username' value='admin' required />
				<p>
					<label for='edit-pw'>Password</label>
					<input type='password' name='pw' id='edit-pw' required />
				</p>
				<p>
					<template />
					<button type='submit'>Log in</button>
				</p>
			</form>
			<h2>Log in with IndieAuth</h2>
			<form action='https://indieauth.com/auth' method='GET'>
				<button type='submit'>Sign In</button>
				<input type='hidden' name='me' value={config.baseUrl} />
				<input type='hidden' name='client_id' value={config.baseUrl} />
				<input
					type='hidden'
					name='redirect_uri'
					value={new URL('/.denizen/indieauth-cb', config.baseUrl)}
				/>
			</form>
		</main>
	</Layout>
)
