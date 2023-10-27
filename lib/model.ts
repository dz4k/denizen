import { ulid } from 'https://deno.land/std@0.203.0/ulid/mod.ts'
import { unescape } from 'https://deno.land/std@0.203.0/html/mod.ts'
import {
	mf2Date,
	MF2Object,
	MF2Properties,
	MF2PropertyValue,
	mf2String,
	mf2StringArray,
	mf2Url,
	mf2UrlArray,
	removeEmptyProperties,
} from './common/mf2.ts'
import { makeSlug } from './common/slug.ts'
import * as config from './config.ts'

/**
 * @see http://microformats.org/wiki/h-entry
 */
export class Post {
	/**
	 * Internal ID.
	 */
	iid: string
	deleted: boolean = false

	name?: string
	summary?: string
	content?: string

	published: Date = new Date()
	updated?: Date

	category: string[] = []

	syndication: URL[] = []

	inReplyTo: Citation[] = []
	bookmarkOf: Citation[] = []
	likeOf: Citation[] = []

	photo: URL[] = []
	video: URL[] = []
	audio: URL[] = []

	uid?: URL
	url = new Set<URL>()

	// TODO: location (.p-location .p-geo) and related props
	// TODO: RSVP (.p-rsvp)
	// TODO: some draft properties: u-listen-of u-watch-of p-read-of u-checkin

	constructor(props?: Partial<Post>) {
		Object.assign(this, props)
		this.published ??= new Date()
		this.iid ??= ulid()
	}

	genUrl() {
		return new URL(
			`/${this.published.getFullYear()}/${
				this.name ? makeSlug(this.name) : this.published.toISOString().slice(4)
			}`,
			config.baseUrl,
		)
	}

	replace(p: MF2Properties) {
		if ('published' in p) this.published = mf2Date(p.published[0])
		if ('x-deleted' in p) this.deleted = p['x-deleted'][0] === 'true'
		if ('uid' in p) this.uid = mf2Url(p.uid[0])
		if ('url' in p) this.url = new Set(mf2UrlArray(p.url))
		if ('updated' in p) this.updated = mf2Date(p.updated[0])
		if ('name' in p) this.name = mf2String(p.name[0])
		if ('summary' in p) this.summary = mf2String(p.summary[0])
		if ('content' in p) {
			const content = p.content[0]
			if (typeof content === 'string') this.content = unescape(content)
			else if ('html' in content) this.content = content.html
			else if (content.value) this.content = unescape(content.value)
		}
		if ('category' in p) this.category = mf2StringArray(p.category)
		if ('syndication' in p) this.syndication = mf2UrlArray(p.syndication)
		if ('photo' in p) this.photo = mf2UrlArray(p.photo)
		if ('video' in p) this.video = mf2UrlArray(p.video)
		if ('audio' in p) this.audio = mf2UrlArray(p.audio)
		if ('in-reply-to' in p) {
			this.inReplyTo = p['in-reply-to'].map((v) => Citation.fromMF2Json(v))
		}
		if ('bookmark-of' in p) {
			this.bookmarkOf = p['bookmark-of'].map((v) => Citation.fromMF2Json(v))
		}
		if ('like-of' in p) {
			this.likeOf = p['like-of'].map((v) => Citation.fromMF2Json(v))
		}
	}

	add(p: MF2Properties) {
		if ('url' in p) mf2UrlArray(p.url).forEach((e) => this.url.add(e))
		if ('category' in p) this.category.push(...mf2StringArray(p.category))
		if ('syndication' in p) this.syndication.push(...mf2UrlArray(p.syndication))
		if ('photo' in p) this.photo.push(...mf2UrlArray(p.photo))
		if ('video' in p) this.video.push(...mf2UrlArray(p.video))
		if ('audio' in p) this.audio.push(...mf2UrlArray(p.audio))
		if ('in-reply-to' in p) {
			this.inReplyTo.push(
				...p['in-reply-to'].map((v) => Citation.fromMF2Json(v)),
			)
		}
		if ('bookmark-of' in p) {
			this.bookmarkOf.push(
				...p['bookmark-of'].map((v) => Citation.fromMF2Json(v)),
			)
		}
		if ('like-of' in p) {
			this.likeOf.push(...p['like-of'].map((v) => Citation.fromMF2Json(v)))
		}
	}

	delete(props: string[] | MF2Properties) {
		if (Array.isArray(props)) {
			for (const prop of props) {
				if (prop === 'url') this.url = new Set()
				if (prop === 'name') this.name = undefined
				if (prop === 'summary') this.summary = undefined
				if (prop === 'content') this.content = undefined
				if (prop === 'category') this.category = []
				if (prop === 'syndication') this.syndication = []
				if (prop === 'photo') this.photo = []
				if (prop === 'video') this.video = []
				if (prop === 'audio') this.audio = []
				if (prop === 'in-reply-to') this.inReplyTo = []
				if (prop === 'bookmark-of') this.bookmarkOf = []
				if (prop === 'like-of') this.likeOf = []
			}
		} else {
			for (const [prop, values] of Object.entries(props)) {
				if (prop === 'url') {
					for (const url of this.url.values()) {
						if (values.includes(url.href)) this.url.delete(url)
					}
				}
				if (prop === 'category') {
					this.category = this.category.filter((c) => !values.includes(c))
				}
				if (prop === 'syndication') {
					this.syndication = this.syndication.filter((c) =>
						!values.includes(c.href)
					)
				}
				if (prop === 'photo') {
					this.photo = this.photo.filter((c) => !values.includes(c.href))
				}
				if (prop === 'video') {
					this.video = this.video.filter((c) => !values.includes(c.href))
				}
				if (prop === 'audio') {
					this.audio = this.audio.filter((c) => !values.includes(c.href))
				}
				if (prop === 'in-reply-to') {
					this.inReplyTo = this.inReplyTo.filter((c) =>
						!values.includes(c.uid?.href ?? c.url[0].href)
					)
				}
				if (prop === 'bookmark-of') {
					this.bookmarkOf = this.bookmarkOf.filter((c) =>
						!values.includes(c.uid?.href ?? c.url[0].href)
					)
				}
				if (prop === 'like-of') {
					this.likeOf = this.likeOf.filter((c) =>
						!values.includes(c.uid?.href ?? c.url[0].href)
					)
				}
			}
		}
	}

	static fromMF2Json(it: unknown): Post {
		const { properties: p } = MF2Object.parse(it)
		const rv = new Post({})
		rv.replace(p)
		return rv
	}

	static fromFormData(form: FormData): Post {
		// discard empty values
		for (const [k, v] of form.entries()) {
			if (k.endsWith('[]')) {
				form.append(k.slice(0, -2), v)
			}
		}

		const props: Partial<Post> = {}

		props.published = new Date()

		// Form data will not have any files
		const get = (k: string) => form.get(k) as string
		const getAll = (k: string) => form.getAll(k).filter(Boolean) as string[]
		const getUrls = (k: string) =>
			form.getAll(k).map((v) => new URL(v as string))

		if (form.has('name')) props.name = get('name')
		if (form.has('summary')) props.summary = get('summary')
		if (form.has('content')) props.content = get('content')
		if (form.has('category')) props.category = getAll('category')
		if (form.has('syndication')) {
			props.syndication = getUrls('syndication')
		}
		if (form.has('photo')) props.photo = getUrls('photo')
		if (form.has('video')) props.video = getUrls('video')
		if (form.has('audio')) props.audio = getUrls('audio')
		if (form.has('in-reply-to')) {
			props.inReplyTo = getUrls('in-reply-to').map((v) => new Citation([v]))
		}
		if (form.has('bookmark-of')) {
			props.bookmarkOf = getUrls('bookmark-of').map((v) => new Citation([v]))
		}
		if (form.has('like-of')) {
			props.likeOf = getUrls('like-of').map((v) => new Citation([v]))
		}

		// TODO configurable URL pattern

		return new Post(props)
	}

	toMF2Json(): MF2Object {
		return removeEmptyProperties({
			type: ['h-entry'],
			properties: {
				name: this.name ? [this.name] : [],
				summary: this.summary ? [this.summary] : [],
				content: this.content ? [this.content] : [],
				published: [this.published.toISOString()],
				updated: this.updated ? [this.updated.toISOString()] : [],
				category: this.category,
				syndication: this.syndication.map(String),
				inReplyTo: this.inReplyTo.map((cite) => cite.toMF2Json()),
				bookmarkOf: this.bookmarkOf.map((cite) => cite.toMF2Json()),
				likeOf: this.likeOf.map((cite) => cite.toMF2Json()),
				photo: this.photo.map(String),
				audio: this.audio.map(String),
				video: this.video.map(String),
				url: Array.from(this.url, String),
				uid: this.uid ? [this.uid.toString()] : [],
				'x-deleted': [String(this.deleted)],
			},
		})
	}
}

/**
 * @see http://microformats.org/wiki/h-cite
 */
export class Citation {
	url: URL[]
	uid?: URL

	name?: string
	author?: Card[]

	published?: Date
	accessed?: Date

	publication?: Card

	content?: string

	/**
    p-publication - for citing articles in publications with more than one author, or perhaps when the author has a specific publication vehicle for the cited work. Also works when the publication is known, but the authorship information is either unknown, ambiguous, unclear, or collaboratively complex enough to be unable to list explicit author(s), e.g. like with many wiki pages.
    p-content for when the citation includes the content itself, like when citing short text notes (e.g. tweets).
     */

	constructor(url: URL[], props?: Partial<Citation>) {
		this.url = url
		Object.assign(this, props)
	}

	static fromMF2Json(it: unknown): Citation {
		const mf2 = MF2PropertyValue.parse(it)
		if (typeof mf2 === 'string') return new Citation([new URL(mf2)])
		if ('html' in mf2) return new Citation([new URL(mf2String(mf2))])

		const { properties: p } = mf2

		if (!('url' in p)) throw 'h-cite has no URL'

		const rv = new Citation(mf2UrlArray(p.url))

		if ('name' in p) rv.name = mf2String(p.name[0])
		if ('content' in p) rv.content = mf2String(p.content[0])
		if ('published' in p) rv.published = mf2Date(p.published[0])
		if ('accessed' in p) rv.accessed = mf2Date(p.accessed[0])
		if ('author' in p) {
			rv.author = p.author.map((v) => Card.fromMf2Json(v))
		}
		if ('publication' in p) {
			rv.publication = Card.fromMf2Json(p.publication[0])
		}

		return rv
	}

	toMF2Json(): MF2Object {
		return removeEmptyProperties({
			type: ['h-cite'],
			value: this.uid?.toString(),
			properties: {
				url: this.url.map(String),
				uid: this.uid ? [this.uid.toString()] : [],
				name: this.name ? [this.name] : [],
				author: this.author?.map((card) => card.toMF2Json()) ?? [],
				published: this.published ? [this.published.toISOString()] : [],
				accessed: this.accessed ? [this.accessed.toISOString()] : [],
				publication: this.publication ? [this.publication.toMF2Json()] : [],
				content: this.content ? [this.content] : [],
			},
		})
	}
}

/**
 * @see http://microformats.org/wiki/h-card
 */
export class Card {
	name: string
	// honorificPrefix?: string
	// givenName?: string
	// additionalName?: string
	// sortString?: string
	// honorificSuffix?: string
	// nickname?: string

	email: URL[] = []
	tel: string[] = []
	// adr: Address[] = []
	// geo: (Geolocation | URL)[] = []
	impp: URL[] = []

	logo: URL[] = []
	photo: URL[] = []

	// Not a Date since birthdays can have unspecified year, month or day
	bday?: string
	anniversary?: string

	org: Card[] = []
	jobTitle?: string
	role?: string

	url: URL[] = []
	uid?: URL

	category: string[] = []
	note: string[] = []

	// p-sex and p-gender-identity suck
	gender: string[] = []
	// u-pronoun and p-x-pronoun-* are both nonstandard and not great, but they'll do
	pronoun: (string | URL)[] = []

	me: Record<string, string> = {}

	// TODO: handle multiple names
	// TODO: what is p-label?
	// TODO: what to do with name parts?
	// TODO: do we need adr and geo?

	constructor(name: string, props?: Partial<Card>) {
		this.name = name
		Object.assign(this, props)
	}

	static fromMf2Json(it: unknown): Card {
		const mf2 = MF2PropertyValue.parse(it)
		if (typeof mf2 === 'string') return new Card(mf2)
		if ('html' in mf2) return new Card(mf2.value ?? mf2.html)

		const p = mf2.properties

		if (!('name' in p)) throw new Error('h-card has no name')

		const rv = new Card(mf2String(p.name[0]))

		if ('email' in p) rv.email = mf2UrlArray(p.email)
		if ('impp' in p) rv.impp = mf2UrlArray(p.impp)
		if ('tel' in p) rv.tel = mf2StringArray(p.tel)
		if ('logo' in p) rv.logo = mf2UrlArray(p.logo)
		if ('photo' in p) rv.photo = mf2UrlArray(p.photo)
		if ('bday' in p) rv.bday = mf2String(p.bday[0])
		if ('anniversary' in p) rv.anniversary = mf2String(p.anniversary[0])
		if ('org' in p) rv.org = p.org.map((v) => Card.fromMf2Json(v))
		if ('job-title' in p) rv.jobTitle = mf2String(p['job-title'][0])
		if ('role' in p) rv.role = mf2String(p.role[0])
		if ('url' in p) rv.url = mf2UrlArray(p.url)
		if ('uid' in p) rv.uid = mf2Url(p.uid[0])
		if ('category' in p) rv.category = mf2StringArray(p.category)
		if ('note' in p) rv.note = mf2StringArray(p.note)
		if ('gender' in p) rv.gender = mf2StringArray(p.gender)
		if ('pronoun' in p) rv.pronoun = mf2StringArray(p.pronoun) // TODO handle URL pronoun
		if ('x-me-key' in p) {
			const values = mf2StringArray(p['x-me-value'])
			mf2StringArray(p['x-me-key']).forEach((name, i) =>
				rv.me[name] = values[i]
			)
		}

		return rv
	}

	toMF2Json(): MF2Object {
		return removeEmptyProperties({
			type: ['h-card'],
			properties: {
				name: [this.name],

				email: this.email.map(String),
				tel: this.tel,
				// adr: Address[] = []
				// geo: (Geolocation | URL)[] = []
				impp: this.impp.map(String),

				logo: this.logo.map(String),
				photo: this.photo.map(String),

				// Not a Date since birthdays can have unspecified year, month or day
				bday: this.bday ? [this.bday] : [],
				anniversary: this.anniversary ? [this.anniversary] : [],

				org: this.org.map((card) => card.toMF2Json()),
				jobTitle: this.jobTitle ? [this.jobTitle] : [],
				role: this.role ? [this.role] : [],

				url: this.url.map(String),
				uid: this.uid ? [this.uid.toString()] : [],

				category: this.category,
				note: this.note,

				// p-sex and p-gender-identity suck
				gender: this.gender,
				// u-pronoun and p-x-pronoun-* are both nonstandard and not great, but they'll do
				pronoun: this.pronoun.map(String),

				'x-me-key': Object.keys(this.me),
				'x-me-value': Object.values(this.me),
			},
		})
	}

	/**
    u-key - cryptographic public key e.g. SSH or GPG
    dt-anniversary
     */
}

export class User {
	constructor(
		public username: string,
		public pwhash: string,
		public profile: Card,
	) {}

	serialize() {
		return {
			...this,
			profile: this.profile.toMF2Json(),
		}
	}

	static deserialize(json: Record<string, unknown>) {
		return new User(
			String(json.username),
			String(json.pwhash),
			Card.fromMf2Json(json.profile),
		)
	}
}
