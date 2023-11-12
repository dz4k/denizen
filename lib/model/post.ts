import { ulid } from 'https://deno.land/std@0.203.0/ulid/mod.ts'
import { escape as htmlEscape } from 'https://deno.land/std@0.203.0/html/mod.ts'
import {
	ImageUrl,
	mf2Date,
	MF2Html,
	mf2ImgArray,
	MF2Object,
	MF2Properties,
	mf2String,
	mf2StringArray,
	mf2Url,
	mf2UrlArray,
	removeEmptyProperties,
} from '../common/mf2.ts'
import { makeSlug } from '../common/slug.ts'
import * as config from '../config.ts'
import { Card } from './card.ts'
import { Citation } from './citation.ts'
import {
	Document,
	DocumentFragment,
	HTMLTemplateElement,
} from '../../deps/dom.ts'

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
	content?: { html: string; value?: string }

	published: Date = new Date()
	updated?: Date

	author: Card[] = []

	category: string[] = []

	syndication: URL[] = []

	inReplyTo: Citation[] = []
	bookmarkOf: Citation[] = []
	likeOf: Citation[] = []

	photo: ImageUrl[] = []
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
			if (typeof content === 'string') {
				this.content = { html: htmlEscape(content) }
			} else if ('html' in content) this.content = content as MF2Html
			else if (content.value) this.content = { html: htmlEscape(content.value) }
		}
		if ('author' in p) this.author = p.author.map((v) => Card.fromMf2Json(v))
		if ('category' in p) this.category = mf2StringArray(p.category)
		if ('syndication' in p) this.syndication = mf2UrlArray(p.syndication)
		if ('photo' in p) this.photo = mf2ImgArray(p.photo)
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
		if ('author' in p) {
			this.author.push(...p.author.map((v) => Card.fromMf2Json(v)))
		}
		if ('photo' in p) this.photo.push(...mf2ImgArray(p.photo))
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
				if (prop === 'author') this.author = []
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
					this.photo = this.photo.filter((c) => !values.includes(c.url.href))
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
		if (form.has('content')) props.content = { html: get('content') }
		if (form.has('category')) props.category = getAll('category')
		if (form.has('syndication')) {
			props.syndication = getUrls('syndication')
		}
		// TODO: alt text in form data
		if (form.has('photo')) {
			props.photo = getUrls('photo').map((url) => ({ url }))
		}
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
				author: this.author.map((card) => card.toMF2Json()),
				published: [this.published.toISOString()],
				updated: this.updated ? [this.updated.toISOString()] : [],
				category: this.category,
				syndication: this.syndication.map(String),
				inReplyTo: this.inReplyTo.map((cite) => cite.toMF2Json()),
				bookmarkOf: this.bookmarkOf.map((cite) => cite.toMF2Json()),
				likeOf: this.likeOf.map((cite) => cite.toMF2Json()),
				photo: this.photo.map(({ url, alt }) => ({ value: url.href, alt })),
				audio: this.audio.map(String),
				video: this.video.map(String),
				url: Array.from(this.url, String),
				uid: this.uid ? [this.uid.toString()] : [],
				'x-deleted': [String(this.deleted)],
			},
		})
	}

	mutateDom(
		cb: (dom: DocumentFragment) => void | Promise<void>,
	): ReturnType<typeof cb> {
		const doc = new Document()
		const template = doc.createElement('template') as HTMLTemplateElement
		template.innerHTML = this.content?.html ?? ''
		const rv = cb(template.content)
		this.content = {
			html: template.innerHTML,
			value: template.innerText,
		}
		return rv
	}
}
