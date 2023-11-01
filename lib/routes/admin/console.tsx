/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import * as config from '../../config.ts'
import { User } from '../../model.ts'
import { getUser, setConfig, updateUser } from '../../db.ts'
import { ImportForm } from './import-blog.tsx'

export const get = async (c: hono.Context<Env>) => {
	const user = await getUser(c.var.session.get('user') as string)
	return c.html(<Console user={user} />)
}

export const updateProfile = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()

	const user = await getUser('admin')
	user.profile.name = formdata.get('name') as string
	user.profile.note = [formdata.get('note') as string]

	const socials = formdata.getAll('me[value]')
	if (socials) {
		formdata.getAll('me[key]').forEach((name, i) => {
			name = (name as string).trim()
			const value = (socials[i] as string).trim()
			if (name !== '' && value != '') user.profile.me[name] = value
		})
	}

	await updateUser(user)

	return c.redirect('/.denizen/console', 303)
}

export const updateSettings = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()
	const siteUrl = formdata.get('site-url')
	if (siteUrl) await setConfig('base url', siteUrl)
	return c.redirect('/.denizen/console', 303)
}

const Console = ({ user }: { user: User }) => (
	<Layout title='Console'>
		<script type='module' src='/.denizen/public/list-input.js' />
		<script type='module' src='/.denizen/public/textarea-autoexpand.js' />
		<header>
			<h1>Console</h1>
		</header>
		<main>
			<section>
				<h2>Profile</h2>
				<form
					action='/.denizen/profile'
					method='POST'
					class='grid'
					style='grid: auto-flow / auto 1fr'
				>
					<p class='grid-row'>
						<label for='profile.name'>Name</label>
						<input
							type='text'
							id='profile.name'
							name='name'
							value={user.profile.name}
						/>
					</p>
					<p class='grid-row'>
						<label for='profile.bio'>Bio</label>
						<textarea name='note' id='profile.bio' data-autoexpand>
							{user.profile.note}
						</textarea>
					</p>
					<p class='grid-row'>
						<label for='profile.socials'>Social links</label>
						<list-input
							id='profile.socials'
							name='me'
							fields='key=text;Link text&value=url;URL'
							value={JSON.stringify(Object.entries(user.profile.me))}
						/>
					</p>
					<p class='grid-row'>
						<span />
						<span>
							<button class='big'>Save</button>
						</span>
					</p>
				</form>
			</section>
			<section>
				<h2>Site</h2>
				<form
					action='/.denizen/site-settings'
					method='POST'
					class='grid'
					style='grid: auto-flow / auto 1fr'
				>
					<p class='grid-row'>
						<label for='edit-site-url'>Site URL</label>
						<input
							type='url'
							name='site-url'
							id='edit-site-url'
							value={config.baseUrl}
						/>
					</p>
					<p class='grid-row'>
						<span />
						<span>
							<button class='big'>Save</button>
						</span>
					</p>
				</form>
			</section>
			<ImportForm />
		</main>
	</Layout>
)
