/** @jsx hono.h */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import { Env } from '../../server.tsx'
import { Layout } from '../../ui.tsx'

import * as bcrypt from '../../../deps/bcrypt.ts'

import { completeInitialSetup, createUser, initialSetupDone } from '../../db.ts'
import { Card, User } from '../../model.ts'

const signup = async (username: string, pw: string, card: Card) => {
	const salt = await bcrypt.genSaltSync()
	const user = new User(username, await bcrypt.hashSync(pw, salt), card)
	await createUser(user)
}

export const middleware: hono.MiddlewareHandler<Env> = async (c, next) => {
	if (
		c.req.path !== '/.denizen/initial-setup' &&
		!c.req.path.startsWith('/.denizen/public/') && !await initialSetupDone()
	) {
		return c.redirect('/.denizen/initial-setup', 303)
	} else await next()
}

export const get = (c: hono.Context<Env>) => c.html(<InitialSetup />)

export const post = async (c: hono.Context<Env>) => {
	if (await initialSetupDone()) return c.status(403)

	// Create admin account
	const form = await c.req.formData()
	const pw = form.get('pw')
	if (typeof pw !== 'string') {
		return c.html(<InitialSetup error='Missing username or password' />, 400)
	}
	const displayName = form.get('name')
	if (typeof displayName !== 'string') {
		return c.html(<InitialSetup error='Please enter a name' />, 400)
	}
	await signup('admin', pw, new Card(displayName))

	// Mark setup as completed
	await completeInitialSetup()

	// Sign in to admin account
	const sesh = c.get('session')
	sesh.set('user', 'admin')
	return c.redirect('/', 303)
}

const InitialSetup = (p: { error?: string }) => (
	<Layout title='Initial Setup -- Denizen'>
		<header>
			<h1>Welcome to Denizen</h1>
			<p class='big'>Choose a password to set up your site</p>
		</header>
		<main>
			{p.error && <div class='bad box'>{p.error}</div>}
			<form method='POST' class='grid' style='grid: auto-flow / auto 1fr'>
				<p class='grid-row'>
					<label for='edit-name'>Name</label>
					<span class='grid'>
						<input
							type='text'
							name='name'
							id='edit-name'
							required
							aria-describedby='desc-edit-name'
						/>
						<span id='desc-edit-name' class='<small> italic'>
							Not a login username -- the name that will be displayed on your
							homepage.
						</span>
					</span>
				</p>
				<p class='grid-row'>
					<label for='edit-site-url'>Site URL</label>
					<input type='url' name='site-url' id='edit-site-url' />
				</p>
				<p class='grid-row'>
					<label for='edit-pw'>Password</label>
					<input type='password' name='pw' id='edit-pw' required />
				</p>
				<p class='grid-row'>
					<button
						type='submit'
						class='big'
						style='grid-column: 2; justify-self: start'
					>
						Get started
					</button>
				</p>
			</form>
		</main>
	</Layout>
)
