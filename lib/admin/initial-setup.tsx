/** @jsx hono.jsx */
/** @jsxFrag hono.Fragment */

import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'
import { Layout } from '../layout.ts'

import * as bcrypt from '../../deps/bcrypt.ts'

import {
	completeInitialSetup,
	createUser,
	initialSetupDone,
	setConfig,
} from '../db.ts'
import { User } from '../model/user.ts'
import { Card } from '../model/card.ts'
import { isValidUrl } from '../common/util.ts'

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

export const get = (c: hono.Context<Env>) =>
	c.html(<InitialSetup theme={c.var.theme} />)

export const post = async (c: hono.Context<Env>) => {
	if (await initialSetupDone()) return c.status(403)

	// Create admin account
	const form = await c.req.formData()
	const pw = form.get('pw')
	if (typeof pw !== 'string') {
		return c.html(
			<InitialSetup theme={c.var.theme} error='Missing username or password' />,
			400,
		)
	}

	const displayName = form.get('name')
	if (typeof displayName !== 'string') {
		return c.html(
			<InitialSetup theme={c.var.theme} error='Please enter a name' />,
			400,
		)
	}

	const siteUrl = form.get('site-url')
	if (
		typeof siteUrl !== 'string' ||
		!isValidUrl(siteUrl)
	) {
		return c.html(
			<InitialSetup
				theme={c.var.theme}
				error='Site URL should be a valid URL'
			/>,
			400,
		)
	}

	const locale = form.get('lang')
	if (typeof locale !== 'string') {
		return c.html('Please choose a language for your blog')
	}

	// Do setup
	await signup('admin', pw, new Card(displayName))
	await setConfig('base url', siteUrl)
	await setConfig('locales', [locale])

	// Mark setup as completed
	await completeInitialSetup()

	// Sign in to admin account
	const sesh = c.get('session')
	sesh.set('user', 'admin')
	return c.redirect('/', 303)
}

const InitialSetup = (p: { error?: string; theme: string }) => (
	<Layout title='Initial Setup -- Denizen' theme={p.theme}>
		<header>
			<h1 style='white-space:nowrap'>Welcome to Denizen</h1>
			{hono.html`<script>
				const welcomes = [
					'Welcome to Denizen',
					'Denizen’e hoş geldiniz',
					'sina kama pona tawa ilo Denizen',
					'Benvido a Denizen',
					'TODO: add more languages',
					'Denizenga xush kelibsiz',
					'Welkom by Denizen',
					'Bienvenue à Denizen',
				]
				const h1 = document.currentScript.previousElementSibling
				let i = 0
				setInterval(async () => {
					await h1.animate({ opacity: [1, 0] }, { duration: 500, easing: 'ease-in-out' }).finished
					h1.textContent = welcomes[++i % welcomes.length]
					await h1.animate({ opacity: [0, 1] }, { duration: 500, easing: 'ease-in-out' })
				}, 3000)
			</script>`}
		</header>
		<main>
			{p.error && <div class='bad box'>{p.error}</div>}
			<form method='POST' class='grid' style='grid: auto-flow / auto 1fr'>
				<p class='grid-row'>
					<label for='edit-lang'>🌐 Site language</label>
					<select name='lang' id='edit-lang'>
						<option value='en'>[af] Afrikaans</option>
						<option value='en' selected>[en] English</option>
						<option value='en'>[es] Esperanto</option>
						<option value='en'>[tok] Toki Pona</option>
						<option value='en'>[tr] Türkçe</option>
					</select>
				</p>
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
					{hono.html`<script>
						document.getElementById('edit-site-url').value = location.origin
					</script>`}
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
