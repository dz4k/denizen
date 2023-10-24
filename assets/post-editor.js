// @ts-check
/// <reference lib="dom" />
/// <reference lib="es2021" />

/**
 * @typedef {object} Field
 * @prop {string} label
 * @prop {boolean} [default]
 * @prop {boolean} [multiple] Can we have more than one of this field?
 * @prop {'text' | 'html' | 'list'} inputKind
 */

import './list-input.js'

let idCounter = 0

class PostEditor extends HTMLElement {
	/**
	 * @type {Record<string, Field>}
	 */
	fields = {
		name: {
			label: 'Title',
			inputKind: 'text',
			default: true,
		},
		summary: {
			label: 'Summary',
			inputKind: 'text',
		},
		content: {
			label: 'Content',
			inputKind: 'html',
			default: true,
		},
		category: {
			label: 'Tags',
			inputKind: 'list',
		},
	}

	constructor() {
		super()
		this.append(html`
            <form data-form method=POST>
				<div data-fields class='grid' style='grid: auto-flow / auto auto 1fr'></div>
				<p>
					${
			Object.entries(this.fields).map(([name, field]) =>
				html`
						<button type="button" data-add-field="${name}"
							${field.default ? 'data-default=1' : ''}>+ ${field.label}</button>
					`
			)
		}
				</p>
				<p><strong><button type="submit" class="big">Post</button></strong>
            </form>
        `)
		this.fieldsDiv =
			/** @type {HTMLFormElement} */ (this.querySelector('[data-fields]'))
		this.addFieldButtons = /** @type {HTMLElement[]} */ (Array.from(
			this.querySelectorAll('[data-add-field]'),
		))
		this.addFieldButtons.forEach((btn) => {
			btn.addEventListener('click', () => {
				this.addField(/** @type {string} */ (btn.dataset.addField))
			})
			if (btn.dataset.default) btn.click()
		})
	}

	/**
	 * @param {string} name
	 */
	addField(name) {
		const field = this.fields[name]
		if (!field) return
		if (!field.multiple) {
			const $field = this.querySelector(`[data-add-field="${name}"]`)
			if ($field) $field.setAttribute('hidden', '')
		}
		const id = idCounter++
		const removeButton = html`
			<button class="<a> unbutton" aria-labelledby="vh-${name}-${id} edit-${name}-${id}"
				onclick="this.closest('post-editor').removeField(this.closest('p'))">
				<span hidden id="vh-${name}-${id}">Remove</span>
				<span aria-hidden="true">×</span>
			</button>`

		switch (field?.inputKind) {
			case 'text':
				this.fieldsDiv.append(html`<p data-field="${name}" class="grid-row">
					${removeButton}
                    <label data-cols="2" for="edit-${name}-${id}">${field.label}</label>
                    <input data-cols="3" type="text" id="edit-${name}-${id}" name="${name}">
                </p>`)
				break

			case 'html':
				this.fieldsDiv.append(html`<p data-field="${name}" class="grid-row">
					${removeButton}
                    <label for="edit-${name}-${id}">${field.label}</label>
                    <textarea id="edit-${name}-${id}" name="${name}"></textarea>
                </p>`)
				break

			case 'list':
				this.fieldsDiv.append(html`<p data-field="${name}" class="grid-row">
					${removeButton}
					<label for="edit-${name}-${id}">${field.label}</label>
					<list-input id="edit-${name}-${id}" name="${name}" fields='=text;' values='[[""]]'></list-input>
				</p>`)
				break
		}
	}

	removeField(el) {
		const fieldName = el.dataset.field
		const field = this.fields[fieldName]
		if (!field) return
		el.remove()
		if (
			!field.multiple &&
			!this.fieldsDiv.querySelector(`[data-field="${fieldName}"]`)
		) {
			const $field = this.querySelector(`[data-add-field="${fieldName}"]`)
			if ($field) $field.setAttribute('hidden', '')
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
