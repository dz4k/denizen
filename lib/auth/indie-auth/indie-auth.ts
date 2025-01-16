import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'

import * as config from '../../config.ts'
import { crypto } from 'jsr:@std/crypto@1.0.3'
import parseMicroformats from '../../mf2/mf2-parser.ts'
import { isAdmin } from '../../admin/middleware.ts'
import { mf2String } from '../../common/mf2.ts'
import { login } from '../login.ts'
import { db } from '../../db.ts'
import { encodeBase64Url } from 'jsr:@std/encoding@1.0.6/base64url'

export const getMetadata = (c: hono.Context<Env>) =>
	c.json({
		issuer: config.baseUrl,
		authorization_endpoint:
			new URL('/.denizen/auth/orize', config.baseUrl).href,
		token_endpoint: new URL('/.denizen/auth/token', config.baseUrl).href,
		code_challenge_methods_supported: ['S256'],
	})

export const getAuth = async (c: hono.Context<Env>) => {
	const {
		response_type,
		client_id,
		redirect_uri,
		code_challenge,
		code_challenge_method,
		scope,
		state,
	} = c.req.query()

	const invalidRequest = () => {
		c.set('title', 'Invalid request')
		return c.var.render('indieauth-invalid-request.vto', { client_id })
	}

	if (
		response_type !== 'code' ||
		!client_id ||
		!redirect_uri ||
		!code_challenge ||
		code_challenge_method !== 'S256' ||
		!state
	) return invalidRequest()

	// "The authorization endpoint SHOULD fetch the client_id URL to retrieve
	// application information and the client's registered redirect URLs, see
	// [Client Information Discovery] for more information."
	// [Client Information Discovery]: https://indieauth.spec.indieweb.org/#client-information-discovery
	const clientId = new URL(client_id), redirectUri = new URL(redirect_uri)
	const clientInfo = await fetchClientInfo(clientId)

	// "If the URL scheme, host or port of the redirect_uri in the request do not
	// match that of the client_id, then the authorization endpoint SHOULD verify
	// that the requested redirect_uri matches one of the redirect URLs published
	// by the client, and SHOULD block the request from proceeding if not."
	if (
		clientId.origin !== redirectUri.origin &&
		!clientInfo?.redirectUrls?.includes(redirectUri.href)
	) return invalidRequest()

	const authorized = isAdmin(c)

	c.set('title', `Authorize ${clientInfo.name ?? client_id}`)
	return c.var.render('indieauth-form.vto', {
		clientInfo,
		client_id,
		redirect_uri,
		code_challenge,
		state,
		scope,
		authorized,
	})
}

export const postAuthorize = async (c: hono.Context<Env>) => {
	const formdata = await c.req.formData()

	// Validate request
	if (
		typeof formdata.get('response') !== 'string' ||
		typeof formdata.get('client_id') !== 'string' ||
		typeof formdata.get('redirect_uri') !== 'string' ||
		typeof formdata.get('code_challenge') !== 'string' ||
		typeof formdata.get('state') !== 'string' ||
		typeof formdata.getAll('scopes').some((s) => typeof s !== 'string')
	) {
		const redirect = new URL(String(formdata.get('redirect_uri')))
		redirect.searchParams.set('error', 'invalid_request')
		redirect.searchParams.set('state', String(formdata.get('state')))
	}

	if (formdata.get('response') !== 'allow') {
		const redirect = new URL(String(formdata.get('redirect_uri')))
		redirect.searchParams.set('error', 'access_denied')
		redirect.searchParams.set('state', String(formdata.get('state')))
		return c.redirect(redirect.href, 302)
	}

	let authorized = isAdmin(c)
	if (!authorized) {
		const user = await login('admin', String(formdata.get('password')))
		if (user === null) {
			c.set('title', 'Invalid password')
			c.status(401)
			return c.var.render('indieauth-invalid-password.vto')
		} else {
			c.var.session.set('user', user)
			authorized = true
		}
	}

	const authCode = await issueAuthCode({
		clientId: formdata.get('client_id') as string,
		redirectUri: formdata.get('redirect_uri') as string,
		scopes: formdata.getAll('scopes') as string[],
		codeChallenge: formdata.get('code_challenge') as string,
	})

	const redirect = new URL(formdata.get('redirect_uri') as string)
	redirect.searchParams.set('code', authCode)
	redirect.searchParams.set('state', formdata.get('state') as string)
	redirect.searchParams.set('iss', config.baseUrl.href)

	return c.redirect(redirect.href, 302)
}

export const postToken = async (c: hono.Context<Env>) => {
	const { grant_type, code, redirect_uri, client_id, code_verifier } = await c
		.req.parseBody()

	if (
		grant_type !== 'authorization_code' ||
		!code ||
		!redirect_uri ||
		!client_id ||
		!code_verifier
	) return c.json({ error: 'invalid_request' }, 400)

	const authCode = await getAuthCode(String(code))

	if (
		!authCode ||
		authCode.clientId !== client_id ||
		authCode.redirectUri !== redirect_uri ||
		authCode.scopes.length === 0 ||
		!verifyPKCE(authCode.codeChallenge, String(code_verifier))
	) return c.json({ error: 'invalid_grant' }, 400)

	const token = await issueToken(authCode)

	return c.json({
		access_token: token,
		token_type: 'Bearer',
		me: config.baseUrl.href,
		scope: authCode.scopes.join(' '),
		// TODO: token expiration & refresh token
	})
}

export const postAuth = async (c: hono.Context<Env>) => {
	const { grant_type, code, redirect_uri, client_id, code_verifier } = await c
		.req.parseBody()

	if (
		grant_type !== 'authorization_code' ||
		!code ||
		!redirect_uri ||
		!client_id ||
		!code_verifier
	) return c.json({ error: 'invalid_request' }, 400)

	const authCode = await getAuthCode(String(code))

	if (
		!authCode ||
		authCode.clientId !== client_id ||
		authCode.redirectUri !== redirect_uri ||
		!verifyPKCE(authCode.codeChallenge, String(code_verifier))
	) return c.json({ error: 'invalid_grant' }, 400)

	return c.json({ me: config.baseUrl.href })
}

type ClientInfo = {
	name?: string
	logo?: string
	redirectUrls?: string[]
}

const fetchClientInfo = async (clientId: URL): Promise<ClientInfo> => {
	if (!clientId.protocol.startsWith('https')) return {}

	const res = await fetch(clientId.href, {
		method: 'GET',
	})
	const html = await res.text()
	const mf2 = parseMicroformats(html, { baseUrl: res.url ?? clientId.href })
	const hApp = mf2.items.find((item) => item.type.includes('h-app'))
	const name = hApp?.properties?.name && mf2String(hApp?.properties?.name[0])
	const logo = hApp?.properties?.logo && mf2String(hApp?.properties?.logo[0])
	const redirectUrls = mf2.rels?.['redirect_urls']

	return {
		name,
		logo,
		redirectUrls,
	}
}

type AuthCodeParams = {
	clientId: string
	redirectUri: string
	scopes: string[]
	codeChallenge: string
}

const issueAuthCode = async (params: AuthCodeParams) => {
	const code = await generateCode()
	await db.set(['IndieAuth codes', code], params, {
		expireIn: 10 * 60 * 1000, // 10 minutes
	})
	return code
}

const getAuthCode = async (code: string) => {
	const params = await db.get(['IndieAuth codes', code])
	if (!params.versionstamp) return null
	await db.delete(['IndieAuth codes', code])
	return params.value as AuthCodeParams
}

const verifyPKCE = (codeChallenge: string, codeVerifier: string) => {
	const hash = crypto.subtle.digestSync(
		'SHA-256',
		new TextEncoder().encode(codeVerifier),
	)
	const challenge = encodeBase64Url(hash)
	return challenge === codeChallenge
}

const generateCode = (): string =>
	encodeBase64Url(crypto.getRandomValues(new Uint8Array(32)))

const issueToken = async (params: AuthCodeParams) => {
	const token = await generateCode()
	await db.set(['IndieAuth tokens', token], params, {
		expireIn: 10 * 60 * 1000, // 10 minutes
	})
	return token
}

export const getTokenData = async (token: string) => {
	const params = await db.get(['IndieAuth tokens', token])
	if (!params.versionstamp) return null
	return params.value as AuthCodeParams
}
