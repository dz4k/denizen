/** @jsx hono.jsx */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import * as config from '../../config.ts'
import { crypto } from 'https://deno.land/std@0.204.0/crypto/mod.ts'
import { parseMicroformats } from '../../../deps/microformats-parser.ts'
import { isAdmin } from '../admin/middleware.ts'
import { mf2String } from '../../common/mf2.ts'
import { login } from '../auth/login.tsx'
import { db } from '../../db.ts'
import { encodeBase64Url } from 'https://deno.land/std@0.204.0/encoding/base64url.ts'

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

	const invalidRequest = () =>
		c.html(
			<Layout
				title='Invalid request'
				theme={c.var.theme}
			>
				<h1>Invalid request</h1>
				<p>
					The app at {client_id}{' '}
					made an invalid request to authorize with your Denizen site. This
					might be a bug in their app, or in Denizen, or an attempt to hack your
					site (it's probably not, but if it is, it failed)
				</p>
			</Layout>,
		)

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

	return c.html(
		<AuthForm
			context={c}
			clientInfo={clientInfo}
			client_id={client_id}
			redirect_uri={redirect_uri}
			code_challenge={code_challenge}
			state={state}
			authorized={authorized}
		/>,
	)
}

export const postAuthorize = async (c: hono.Context<Env>) => {
	const formdata = await c.req.parseBody()

	// Validate request
	if (
		typeof formdata.response !== 'string' ||
		typeof formdata.client_id !== 'string' ||
		typeof formdata.redirect_uri !== 'string' ||
		typeof formdata.code_challenge !== 'string' ||
		typeof formdata.state !== 'string'
	) {
		const redirect = new URL(String(formdata.redirect_uri))
		redirect.searchParams.set('error', 'invalid_request')
		redirect.searchParams.set('state', String(formdata.state))
	}

	if (formdata.response !== 'allow') {
		const redirect = new URL(String(formdata.redirect_uri))
		redirect.searchParams.set('error', 'access_denied')
		redirect.searchParams.set('state', String(formdata.state))
		return c.redirect(redirect.href, 302)
	}

	let authorized = isAdmin(c)
	if (!authorized) {
		const user = await login('admin', String(formdata.password))
		if (user === null) {
			return c.html(
				<Layout
					title='Invalid password'
					theme={c.var.theme}
				>
					<h1>Invalid password</h1>
					<p>
						The password you entered is incorrect. Please try again.
					</p>
				</Layout>,
				401,
			)
		} else {
			c.var.session.set('user', user)
			authorized = true
		}
	}

	const authCode = await issueAuthCode(c, {
		clientId: String(formdata.client_id),
		redirectUri: String(formdata.redirect_uri),
		scopes: Array.isArray(formdata.scopes)
			? formdata.scopes
			: [String(formdata.scopes)],
		codeChallenge: String(formdata.code_challenge),
	})

	const redirect = new URL(String(formdata.redirect_uri))
	redirect.searchParams.set('code', authCode)
	redirect.searchParams.set('state', String(formdata.state))
	redirect.searchParams.set('iss', config.baseUrl.href)

	return c.redirect(redirect.href, 302)
}

export const postToken = async (c: hono.Context<Env>) => {
	const { grant_type, code, redirect_uri, client_id, code_verifier } =
		await c.req.parseBody()
	
	if (
		grant_type !== 'authorization_code' ||
		!code ||
		!redirect_uri ||
		!client_id ||
		!code_verifier
	) return c.json({ error: 'invalid_request' }, 400)

	const authCode = await getAuthCode(c, String(code))

	if (
		!authCode ||
		authCode.clientId !== client_id ||
		authCode.redirectUri !== redirect_uri ||
		authCode.scopes.length === 0 ||
		!verifyPKCE(authCode.codeChallenge, String(code_verifier))
	) return c.json({ error: 'invalid_grant' }, 400)

	const token = await issueToken(c, authCode)

	return c.json({
		access_token: token,
		token_type: 'Bearer',
		me: config.baseUrl.href,
		scope: authCode.scopes.join(' '),
		// TODO: token expiration & refresh token
	})
}

export const postAuth = async (c: hono.Context<Env>) => {
	const { grant_type, code, redirect_uri, client_id, code_verifier } =
		await c.req.parseBody()
	
	if (
		grant_type !== 'authorization_code' ||
		!code ||
		!redirect_uri ||
		!client_id ||
		!code_verifier
	) return c.json({ error: 'invalid_request' }, 400)

	const authCode = await getAuthCode(c, String(code))

	if (
		!authCode ||
		authCode.clientId !== client_id ||
		authCode.redirectUri !== redirect_uri ||
		!verifyPKCE(authCode.codeChallenge, String(code_verifier))
	) return c.json({ error: 'invalid_grant' }, 400)

	return c.json({ me: config.baseUrl.href })
}

type AuthFormProps = {
	context: hono.Context<Env>
	clientInfo: ClientInfo
	client_id: string
	redirect_uri: string
	code_challenge: string
	state: string
	scope?: string
	authorized: boolean
}

const AuthForm = ({
	context: c,
	clientInfo,
	client_id,
	redirect_uri,
	code_challenge,
	state,
	scope,
	authorized,
}: AuthFormProps) => (
	<Layout
		title={`Authorize ${clientInfo.name ?? client_id}`}
		theme={c.var.theme}
	>
		<form action='/.denizen/auth/orize' method='POST'>
			{scope
				? (
					<>
						<h1>Authorize {clientInfo.name ?? client_id}?</h1>
						<p>
							The app at {client_id}{' '}
							wants to access the following on your Denizen site:
						</p>
						<fieldset>
							<legend>Requested scopes</legend>
							{scope.split(/\s+/g).map((s) => (
								<label>
									<input type='checkbox' name='scopes' value={s} checked />
									{scope}
								</label>
							))}
						</fieldset>
					</>
				)
				: (
					<h1>
						Log in to {client_id} with your Denizen site
					</h1>
				)}
			{!authorized
				? (
					<label>
						Password
						<input type='password' name='password' required />
					</label>
				)
				: ''}
			<button type='submit' name='response' value='allow'>Allow</button>
			<button type='submit' name='response' value='deny'>Deny</button>
			<input type='hidden' name='client_id' value={client_id} />
			<input type='hidden' name='redirect_uri' value={redirect_uri} />
			<input type='hidden' name='code_challenge' value={code_challenge} />
			<input type='hidden' name='state' value={state} />
		</form>
	</Layout>
)

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
	const mf2 = parseMicroformats({ html, baseUrl: res.url ?? clientId.href })
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

const issueAuthCode = async (c: hono.Context<Env>, params: AuthCodeParams) => {
	const code = await generateCode()
	await db.set(['IndieAuth codes', code], params, {
		expireIn: 10 * 60 * 1000, // 10 minutes
	})
	return code
}

const getAuthCode = async (c: hono.Context<Env>, code: string) => {
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

const issueToken = async (c: hono.Context<Env>, params: AuthCodeParams) => {
	const token = await generateCode()
	await db.set(['IndieAuth tokens', token], params, {
		expireIn: 10 * 60 * 1000, // 10 minutes
	})
	return token
}
