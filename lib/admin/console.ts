import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import * as config from '../config.ts'
import { getUser, setConfig, updateUser } from '../db.ts'
import { DenizenBadge } from '../model/card.ts'

export const get = async (c: hono.Context<Env>) => {
	const user = await getUser(c.var.session.get('user') as string)
	c.set('title', 'Console')
	return c.var.render('console.vto', {
		user,
		theme: c.var.theme,
		themes: config.themes,
	})
}

export const updateProfile = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()

	const user = await getUser('admin')
	user.profile.name = formdata.get('name') as string
	user.profile.note = [formdata.get('note') as string]

	// Profile image
	const photo = formdata.get('photo')
	if (photo instanceof File) {
		const filename = crypto.randomUUID()
		const oldUrl = user.profile.photo[0]?.url
		if (oldUrl) {
			await c.var.storage.del(oldUrl.pathname.split('/').pop() as string)
		}
		await c.var.storage.write(
			filename,
			photo,
			{ cacheControl: 'public, max-age=31536000, immutable' },
		)
		user.profile.photo = [{
			url: new URL(`/.denizen/storage/${filename}`, c.var.baseUrl),
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
	const accentHue = formdata.get('accent[hue]')
	if (accentHue) await setConfig('accent hue', accentHue)
	return c.redirect('/.denizen/console', 303)
}

export const postBadge = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()
	const photo = formdata.get('photo'),
		alt = formdata.get('alt'),
		href = formdata.get('url')
	const url = href ? new URL(href as string) : undefined

	const filename = crypto.randomUUID()
	await c.var.storage.write(
		filename,
		photo as File,
		{ cacheControl: 'public, max-age=31536000, immutable' },
	)
	const photoUrl = new URL(`/.denizen/storage/${filename}`, c.var.baseUrl)

	const badge = new DenizenBadge({
		photo: { url: photoUrl, alt: (alt ?? undefined) as string | undefined },
		url,
	})
	const user = await getUser('admin')

	user.profile.denizenBadge.push(badge)
	updateUser(user)

	return c.var.render('console.vto#badge', { badge })
}

export const deleteBadge = async (c: hono.Context<Env>) => {
	const badgeIid = c.req.param('iid')
	const user = await getUser('admin')
	const index = user.profile.denizenBadge.findIndex((badge) =>
		badge.iid === badgeIid
	)
	if (index === -1) return c.body(null, 404)
	user.profile.denizenBadge.splice(index, 1)
	updateUser(user)
	return c.html('')
}
