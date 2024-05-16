import * as hono from '../../deps/hono.ts'

type SessionOptions = {
	db: Deno.Kv
	namespace: Deno.KvKey
	expireSeconds: number
}

export class Session {
	data: Record<string, unknown>
	changed = false
	deleted = false

	constructor(data: Record<string, unknown>) {
		this.data = data ?? {}
	}

	get(key: string): unknown {
		return this.data[key]
	}

	set(key: string, value: unknown): void {
		this.data[key] = value
		this.changed = true
	}

	delete(): void {
		this.deleted = true
	}
}

export const sessionMiddleware = (
	{ db, namespace, expireSeconds }: SessionOptions,
) => {
	const getSessionData = (sessionId: string) =>
		db.get([...namespace, sessionId]).then((data) => data.value)

	const saveSessionData = (sessionId: string, session: unknown) =>
		db.set([...namespace, sessionId], session, {
			expireIn: expireSeconds * 1000,
		})

	const deleteSessionData = (sessionId: string) =>
		db.delete([...namespace, sessionId])

	return async (c: hono.Context, next: () => void) => {
		let sessionId = hono.getCookie(c, 'sesh')
		const sessionData = sessionId ? await getSessionData(sessionId) : {}
		const session = new Session(sessionData as Record<string, unknown>)
		c.set('session', session)
		await next()
		if (session.deleted && sessionId) {
			await deleteSessionData(sessionId)
			hono.deleteCookie(c, 'sesh')
		} else if (session.changed) {
			if (!sessionId) {
				sessionId = Math.random().toString(36).slice(2)
				hono.setCookie(c, 'sesh', sessionId, {
					sameSite: 'Lax',
					httpOnly: true,
					secure: true,
					maxAge: expireSeconds,
				})
			}
			await saveSessionData(sessionId, session.data)
		}
	}
}
