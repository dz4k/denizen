// @ts-check
/// <reference lib="dom" />

import { $, $$, on } from 'https://unpkg.com/missing.css@1.1.1/dist/js/19.js'

/**
 * @typedef {object} Field
 * @prop {string} label
 * @prop {string} queryParam
 * @prop {boolean} [default]
 * @prop {'text' | 'html'} inputKind
 */

let idCounter = 0

class PostEditor extends HTMLElement {
	/**
	 * @type {Field[]}
	 */
	fields = [{
		label: 'Title',
		queryParam: 'name',
		inputKind: 'text',
		default: true,
	}, {
		label: 'Summary',
		queryParam: 'summary',
		inputKind: 'text',
	}, {
		label: 'Content',
		queryParam: 'content',
		inputKind: 'html',
		default: true,
	}, {
		label: 'Tag',
		queryParam: 'category',
		inputKind: 'text',
	}]

	constructor() {
		super()
		this.append(html`
            <form data-form method=POST>
				<div data-fields class='table rows'></div>
				<p><strong><button type="submit">Post</button></strong>
            </form>
            <p>
                ${
			this.fields.map((field) =>
				html`
                    <button data-add-field="${field.queryParam}"
						${field.default ? 'data-default=1' : ''}>+ ${field.label}</button>
                `
			)
		}
            </p>
        `)
		this.fieldsDiv = /** @type {HTMLFormElement} */ ($(this, '[data-fields]'))
		this.addFieldButtons =
			/** @type {HTMLElement[]} */ ($$(this, '[data-add-field]'))
		this.addFieldButtons.forEach((btn) => {
			on(btn, 'click', () => {
				this.addField(/** @type {string} */ (btn.dataset.addField))
			})
			if (btn.dataset.default) btn.click()
		})
	}

	/**
	 * @param {string} name
	 */
	addField(name) {
		const field = this.fields.find((field) => field.queryParam === name)
		const id = idCounter++
		const removeButton = html`
			<button class="<a> unbutton" aria-labelledby="vh-${name}-${id} edit-${name}-${id}"
				onclick="this.closest('p').remove()">
				<span hidden id="vh-${name}-${id}">Remove</span>
				<span aria-hidden="true">×</span>
			</button>`

		switch (field?.inputKind) {
			case 'text':
				this.fieldsDiv.append(html`<p>
					${removeButton}
                    <label for="edit-${name}-${id}">${field.label}</label>
                    <input type="text" id="edit-${name}-${id}" name="${name}">
                </p>`)
				break

			case 'html':
				this.fieldsDiv.append(html`<p>
					${removeButton}
                    <label for="edit-${name}-${id}">${field.label}</label>
                    <textarea id="edit-${name}-${id}" name="${name}"></textarea>
                </p>`)
				break
		}
	}
}

/**
 * Convert a node to equivalent HTML.
 * @param {Node} node
 * @returns string
 */
export function stringifyNode(node) {
	const tmp = document.createElement('div')
	tmp.append(node)
	return tmp.innerHTML
}

/**
 * HTML-escape a string.
 * If given a DOM node, it will return **unescaped** HTML for it.
 * Returns empty string when given null or undefined.
 * @param {unknown} s
 * @returns {string}
 */
export function htmlescape(s) {
	if (s === null || s === undefined) return ''
	if (Array.isArray(s)) return s.map(htmlescape).join('')
	if (s instanceof Node) return stringifyNode(s)
	return String(s)
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('\'', '&#x27;')
		.replaceAll('"', '&quot;')
}

/**
 * Template literal that escapes HTML in interpolated values and returns a DocumentFragment.
 * Can also be called with a string to parse it as HTML.
 * To let trusted HTML through escaping, parse it first:
 *
 *     html`<p>My trusted markup: ${html(trustedMarkup)}</p>`
 *
 * @param {TemplateStringsArray | string} str
 * @param {...unknown} values
 * @returns {DocumentFragment}
 */
export function html(str, ...values) {
	const tmpl = document.createElement('template')
	if (typeof str === 'object' && 'raw' in str) {
		str = String.raw(str, ...values.map(htmlescape))
	}
	tmpl.innerHTML = str
	return tmpl.content
}

customElements.define('post-editor', PostEditor)
