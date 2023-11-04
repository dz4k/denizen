import {
	mf2Date,
	MF2Object,
	MF2PropertyValue,
	mf2String,
	mf2UrlArray,
	removeEmptyProperties,
} from '../common/mf2.ts'
import { Card } from './card.ts'

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
		if (!('properties' in mf2)) return new Citation([new URL(mf2String(mf2))])

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
