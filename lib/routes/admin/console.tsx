/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import * as config from '../../config.ts'
import { User } from '../../model/user.ts'
import { getUser, setConfig, updateUser } from '../../db.ts'
import { ImportForm } from './import-blog.tsx'
import { Face } from '../../widgets/face.tsx'

export const get = async (c: hono.Context<Env>) => {
	const user = await getUser(c.var.session.get('user') as string)
	return c.html(<Console user={user} theme={await config.theme()} />)
}

export const updateProfile = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()

	const user = await getUser('admin')
	user.profile.name = formdata.get('name') as string
	user.profile.note = [formdata.get('note') as string]

	// Profile image
	const photo = formdata.get('photo')
	if (photo instanceof File) {
		console.log('photo', photo)
		const filename = crypto.randomUUID()
		const oldUrl = user.profile.photo[0]?.url
		if (oldUrl) await c.var.storage.del(oldUrl.pathname.split('/').pop() as string)
		await c.var.storage.write(filename, photo)
		user.profile.photo = [{
			url: new URL(`/.denizen/storage/${filename}`, config.baseUrl),
		}]
	}

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
	const lang = formdata.get('lang')
	if (lang) await setConfig('locales', [lang])
	return c.redirect('/.denizen/console', 303)
}

export const updateTheme = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()
	const theme = formdata.get('theme')
	if (theme) await setConfig('theme', theme)
	return c.redirect('/.denizen/console', 303)
}

const Console = ({ user, theme }: { user: User; theme: string }) => (
	<Layout title='Console' theme={theme}>
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
					enctype='multipart/form-data'
					class='grid'
					style='grid: auto-flow / auto 1fr'
				>
					<p class='grid-row'>
						<label for='profile.photo'>Photo</label>
						<span>
							<Face card={user.profile} link={undefined} />
							<input type='file' id='profile.photo' name='photo' />
						</span>
					</p>
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
						<label for='edit-lang'>Language</label>
						{/* TODO: actual language picker */}
						<input
							type='text'
							name='lang'
							id='edit-lang'
							value={config.lang()}
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
				<h2>Theme</h2>
				<form
					action='/.denizen/theme-settings'
					method='POST'
					class='grid'
					style='grid: auto-flow / auto 1fr'
				>
					<p class='grid-row'>
						<label for='edit-theme'>Theme</label>
						<select name='theme' id='edit-theme'>
							{Object.entries(config.themes).map(([id, themeData]) => (
								<option value={id} selected={theme === id}>
									{themeData.name}
								</option>
							))}
						</select>
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
