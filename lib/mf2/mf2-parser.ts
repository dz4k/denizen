// Inspired by <https://github.com/microformats/microformats-parser>, (c) 2020 Aimee Gamble-Milner.
// See <https://github.com/microformats/microformats-parser/blob/main/LICENSE>.
//
// A microformats2 parser.
// No legacy microformats support.

import {
	MF2Document,
	MF2Img,
	MF2Object,
	MF2PropertyValue,
} from '../common/mf2.ts'
import { Document, DOMParser, Element, Node, Text } from '../../deps/dom.ts'

export type MF2Options = {
	baseUrl: string
}

const textContent = (el: Element): string => {
	el = el.cloneNode(true) as Element
	el.querySelectorAll('script, style').forEach((s) =>
		s.parentNode!.removeChild(s)
	)
	el.querySelectorAll('img').forEach((img) => {
		const alt = (img as Element).getAttribute('alt')
		if (alt) {
			img.parentNode!.replaceChild(new Text(alt), img)
		}
	})
	return el.textContent
}

const isMicroformatRootClass = (className: string): boolean =>
	className.startsWith('h-')

const isMicroformatRoot = (el: Element): boolean => {
	for (let i = 0; i < el.classList.length; i++) {
		const className = el.classList.item(i)!
		if (isMicroformatRootClass(className)) {
			return true
		}
	}
	return false
}

const findMicroformatRoots = (
	node: Element,
	{ includeSelf }: { includeSelf: boolean } = { includeSelf: true },
): Element[] => {
	const roots = [] as Element[]
	if (includeSelf && isMicroformatRoot(node)) {
		roots.push(node)
	}
	for (let i = 0; i < node.children.length; i++) {
		const child = node.children.item(i)!
		if (isMicroformatRoot(child as Element)) {
			roots.push(child as Element)
		} else {
			roots.push(...findMicroformatRoots(child))
		}
	}
	return roots
}

const isMicroformatPropertyClass = (className: string): boolean =>
	className.startsWith('p-') ||
	className.startsWith('u-') ||
	className.startsWith('dt-') ||
	className.startsWith('e-')

const findMicroformatPropertyElements = (
	node: Element,
): Record<string, Element[]> => {
	const properties: Record<string, Element[]> = {}
	const addProperty = (prop: string, el: Element) =>
		(properties[prop] ??= []).push(el)

	for (let i = 0; i < node.children.length; i++) {
		const child = node.children.item(i)!
		for (let i = 0; i < child.classList.length; i++) {
			const className = child.classList.item(i)!
			if (isMicroformatPropertyClass(className)) {
				addProperty(className, child as Element)
			}
		}

		// TODO: should we be ignoring properties nested in e-* elements?

		if (!isMicroformatRoot(child as Element)) {
			Object.assign(
				properties,
				findMicroformatPropertyElements(child as Element),
			)
		}
	}
	return properties
}

const getAttributeIfTag = (
	el: Element,
	tag: string,
	attr: string,
): string | null =>
	el.tagName === tag.toUpperCase() ? el.getAttribute(attr) : null

// TODO these 4 functions: make spec compliant

const parseTextProperty = (el: Element): MF2PropertyValue =>
	// valueClass(el) ??
	getAttributeIfTag(el, 'abbr', 'title') ??
		getAttributeIfTag(el, 'link', 'title') ??
		getAttributeIfTag(el, 'data', 'value') ??
		getAttributeIfTag(el, 'img', 'alt') ??
		getAttributeIfTag(el, 'area', 'alt') ??
		getAttributeIfTag(el, 'meta', 'content') ??
		textContent(el)

const tryParseUrlProperty = (el: Element): MF2PropertyValue | null =>
	getAttributeIfTag(el, 'a', 'href') ??
		getAttributeIfTag(el, 'area', 'href') ??
		getAttributeIfTag(el, 'link', 'href') ??
		parseImage(el) ??
		getAttributeIfTag(el, 'audio', 'src') ??
		getAttributeIfTag(el, 'source', 'src') ??
		getAttributeIfTag(el, 'iframe', 'src') ??
		getAttributeIfTag(el, 'video', 'src') ??
		getAttributeIfTag(el, 'video', 'poster') ??
		getAttributeIfTag(el, 'object', 'data') ??
		// valueClass(el) ??
		getAttributeIfTag(el, 'abbr', 'title') ??
		getAttributeIfTag(el, 'data', 'value') ??
		getAttributeIfTag(el, 'input', 'value') ??
		getAttributeIfTag(el, 'meta', 'content')

const parseUrlProperty = (el: Element): MF2PropertyValue =>
	tryParseUrlProperty(el) ?? textContent(el)

const parseImage = (el: Element): MF2Img | null =>
	el.tagName === 'IMG'
		? {
			value: el.getAttribute('src') ?? '',
			alt: el.getAttribute('alt') ?? '',
		}
		: null

const tryParseDatetimeProperty = (el: Element): MF2PropertyValue | null =>
	getAttributeIfTag(el, 'time', 'datetime') ??
		getAttributeIfTag(el, 'ins', 'datetime') ??
		getAttributeIfTag(el, 'del', 'datetime') ??
		getAttributeIfTag(el, 'abbr', 'title') ??
		getAttributeIfTag(el, 'data', 'value') ??
		getAttributeIfTag(el, 'input', 'value') ??
		getAttributeIfTag(el, 'meta', 'content')

const parseDatetimeProperty = (el: Element): MF2PropertyValue =>
	tryParseDatetimeProperty(el) ?? textContent(el)

const parseContentProperty = (el: Element): MF2PropertyValue => ({
	html: el.innerHTML,
	value: textContent(el),
	...(el.hasAttribute('lang') ? { lang: el.getAttribute('lang') } : {}),
})

// end todo

const parseMicroformatProperty = (
	prop: string,
	el: Element,
): MF2PropertyValue => {
	if (isMicroformatRoot(el)) return parseMicroformat(el)
	if (prop.startsWith('p-')) return parseTextProperty(el)
	if (prop.startsWith('u-')) return parseUrlProperty(el)
	if (prop.startsWith('dt-')) return parseDatetimeProperty(el)
	if (prop.startsWith('e-')) return parseContentProperty(el)
	throw new Error(`Unknown microformat property kind: ${prop}`)
}

const implyName = (node: Element): MF2PropertyValue[] => {
	if (node.tagName === 'IMG') return [node.getAttribute('alt') ?? '']
	if (node.tagName === 'AREA') return [node.getAttribute('alt') ?? '']
	if (node.tagName === 'ABBR') return [node.getAttribute('title') ?? '']

	let ch = node.querySelector('img:only-child[alt]:not([alt=""])')
	if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('alt')!]
	ch = node.querySelector('area:only-child[alt]:not([alt=""])')
	if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('alt')!]
	ch = node.querySelector('abbr:only-child[title]:not([title=""])')
	if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('title')!]

	const onlyChild = node.children.length === 1
		? node.children[0] as Element
		: null
	if (onlyChild && !isMicroformatRoot(onlyChild)) {
		ch = onlyChild.querySelector('img:only-child[alt]:not([alt=""])')
		if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('alt')!]
		ch = onlyChild.querySelector('area:only-child[alt]:not([alt=""])')
		if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('alt')!]
		ch = onlyChild.querySelector('abbr:only-child[title]:not([title=""])')
		if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('title')!]
	}
	return [textContent(node)]
}

const implyPhoto = (node: Element): MF2PropertyValue[] | null => {
	if (node.tagName === 'IMG') return [parseImage(node)!]
	if (node.tagName === 'OBJECT' && node.hasAttribute('data')) {
		return [node.getAttribute('data')!]
	}
	let ch = node.querySelector('img[src]:only-of-type')
	if (ch && !isMicroformatRoot(ch)) return [parseImage(ch)!]
	ch = node.querySelector('object[data]:only-of-type')
	if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('data')!]

	const onlyChild = node.children.length === 1
		? node.children[0] as Element
		: null
	if (onlyChild && !isMicroformatRoot(onlyChild)) {
		ch = onlyChild.querySelector('img[src]:only-of-type')
		if (ch && !isMicroformatRoot(ch)) return [parseImage(ch)!]
		ch = onlyChild.querySelector('object[data]:only-of-type')
		if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('data')!]
	}
	return null
}

const implyUrl = (node: Element): MF2PropertyValue[] | null => {
	if (node.tagName === 'A' && node.hasAttribute('href')) {
		return [node.getAttribute('href')!]
	}
	if (node.tagName === 'AREA' && node.hasAttribute('href')) {
		return [node.getAttribute('href')!]
	}
	let ch = node.querySelector('a[href]:only-of-type')
	if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('href')!]
	ch = node.querySelector('area[href]:only-of-type')
	if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('href')!]

	const onlyChild = node.children.length === 1
		? node.children[0] as Element
		: null
	if (onlyChild && !isMicroformatRoot(onlyChild)) {
		ch = onlyChild.querySelector('a[href]:only-of-type')
		if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('href')!]
		ch = onlyChild.querySelector('area[href]:only-of-type')
		if (ch && !isMicroformatRoot(ch)) return [ch.getAttribute('href')!]
	}
	return null
}

const implyProperties = (
	node: Element,
	classes: string[],
	props: MF2Object['properties'],
) => {
	const noneWithPrefixes = (prefixes: string[]) =>
		!classes.some((el) => prefixes.some((p) => el.startsWith(p)))
	if (!props.name && noneWithPrefixes(['p-', 'e-'])) {
		props.name = implyName(node)
	}
	if (!props.photo && noneWithPrefixes(['u-'])) {
		const photo = implyPhoto(node)
		if (photo) props.photo = photo
	}
	if (!props.url && noneWithPrefixes(['u-'])) {
		const url = implyUrl(node)
		if (url) props.url = url
	}
}

const parseMicroformatProperties = (
	node: Element,
	children: MF2Object[],
) => {
	const properties = {} as MF2Object['properties']
	const propertyElements = findMicroformatPropertyElements(node)
	Object.entries(propertyElements).forEach(([prop, elements]) => {
		const baseProp = prop.replace(/^(p-|u-|dt-|e-)/, '')
		properties[baseProp] = elements.map((el) =>
			parseMicroformatProperty(prop, el)
		)
	})
	if (
		!Object.keys(propertyElements).some((el) =>
			el.startsWith('p-') || el.startsWith('e-')
		) && !children.length
	) {
		implyProperties(node, Object.keys(propertyElements), properties)
	}
	return properties
}

const parseMicroformat = (node: Element): MF2Object => {
	const classes = Array.from(node.classList)
	const type = classes.filter(isMicroformatRootClass)
	const children = findMicroformatRoots(node, { includeSelf: false })
		.map(parseMicroformat)
	const properties = parseMicroformatProperties(node, children)
	return { type, properties, children }
}

const parseMicroformats = (root: Element): MF2Object[] =>
	findMicroformatRoots(root).map(parseMicroformat)

const parseRels = (html: Document) => {
	const rels = {} as MF2Document['rels']
	const relUrls = {} as MF2Document['rel-urls']

	html.querySelectorAll(':is(a, link)[rel]').forEach((n) => {
		const link = n as Element
		const rel = link.getAttribute('rel')!
		const relList = rel.trim().split(/\s+/)
		const href = link.getAttribute('href')!
		for (const r of relList) {
			if (!rels[r]) {
				rels[r] = []
			}
			rels[r].push(href)
		}
		relUrls[href] = {
			rels: relList,
			media: link.getAttribute('media') ?? undefined,
			hreflang: link.getAttribute('hreflang') ?? undefined,
			text: textContent(link),
		}
	})

	return { rels, relUrls }
}

const mf2 = (
	html: string | Document,
	{ baseUrl }: MF2Options,
): MF2Document => {
	if (typeof html === 'string') {
		const parsed = new DOMParser().parseFromString(html, 'text/html')
		if (!parsed) {
			throw new Error('Failed to parse HTML')
		}
		html = parsed
	}

	const items = parseMicroformats(html.documentElement!)
	const { rels, relUrls } = parseRels(html)

	return {
		items,
		rels,
		'rel-urls': relUrls,
	}
}

export default mf2
