import { ulid } from 'https://deno.land/std@0.203.0/ulid/mod.ts'
import {
	mf2Date,
	MF2Object,
	MF2PropertyValue,
	mf2String,
	mf2StringArray,
	mf2Url,
	mf2UrlArray,
	removeEmptyProperties,
} from './mf2.ts'
import { makeSlug } from './slug.ts'
import * as config from '../config.ts'

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
				this.name
					? makeSlug(this.name)
					: this.published.toISOString().slice(4)
			}`,
			config.baseUrl,
		)
	}

	static fromMF2Json(it: unknown): Post {
		const { properties: p } = MF2Object.parse(it)

		if (!('url' in p) && !('uid' in p)) throw new Error('h-entry has no URL')
		if (!('published' in p)) throw new Error('h-entry has no publication date')

		const rv = new Post({})

		rv.published = mf2Date(p.published[0])
		if ('x-deleted' in p) rv.deleted = p['x-deleted'][0] === 'true'
		if ('uid' in p) rv.uid = mf2Url(p.uid[0])
		if ('url' in p) rv.url = new Set(mf2UrlArray(p.url))
		if ('updated' in p) rv.updated = mf2Date(p.updated[0])
		if ('name' in p) rv.name = mf2String(p.name[0])
		if ('summary' in p) rv.summary = mf2String(p.summary[0])
		if ('content' in p) rv.content = mf2String(p.content[0])
		if ('category' in p) rv.category = mf2StringArray(p.category)
		if ('syndication' in p) rv.syndication = mf2UrlArray(p.syndication)
		if ('photo' in p) rv.photo = mf2UrlArray(p.photo)
		if ('video' in p) rv.video = mf2UrlArray(p.video)
		if ('audio' in p) rv.audio = mf2UrlArray(p.audio)
		if ('in-reply-to' in p) {
			rv.inReplyTo = p['in-reply-to'].map((v) => Citation.fromMF2Json(v))
		}
		if ('bookmark-of' in p) {
			rv.bookmarkOf = p['bookmark-of'].map((v) => Citation.fromMF2Json(v))
		}
		if ('like-of' in p) {
			rv.likeOf = p['like-of'].map((v) => Citation.fromMF2Json(v))
		}
		return rv
	}

	static fromFormData(form: FormData): Post {
		// discard empty values
		for (const [k, v] of form.entries()) {
			if (v === '') form.delete(k)
		}

		const props: Partial<Post> = {}

		props.published = new Date()

		// Form data will not have any files
		const get = (k: string) => form.get(k) as string
		const getAll = (k: string) => form.getAll(k) as string[]
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
		if ('html' in mf2) return new Card(mf2.value)

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
				rv.me[name] = values[i])
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
