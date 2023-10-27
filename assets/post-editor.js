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

import { h } from './util.js'
import { ListInput } from './list-input.js'

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
			default: true,
		},
	}

	constructor() {
		super()
		this.append(
			this.fieldsDiv = h('div', {
				'@data-fields': true,
				className: 'grid',
				style: 'grid: auto-flow / auto auto 1fr',
			}),
			h(
				'p',
				{ style: 'display: flex; gap: .5em' },
				this.addFieldButtons =
					/** @type {HTMLElement[]} */ (Object.entries(this.fields).map((
						[name, field],
					) =>
						h(
							'button',
							{
								type: 'button',
								'@data-add-field': name,
								'@data-default': field.default ? 1 : '',
							},
							'+ ',
							field.label,
						)
					)),
			),
			h(
				'p',
				{},
				h('button', { type: 'submit', className: 'big' }, 'Post'),
			),
		)
		this.addFieldButtons.forEach((btn) => {
			btn.addEventListener('click', () => {
				this.addField(/** @type {string} */ (btn.dataset.addField))
			})
			if (btn.dataset.default && !this.hasAttribute('values')) btn.click()
		})

		// Initial value
		const valuesAttribute = this.getAttribute('values')
		if (valuesAttribute) {
			const properties = JSON.parse(valuesAttribute)
			for (const [name, values] of Object.entries(properties)) {
				console.log(name, this.fields[name], values)
				if (this.fields[name]?.inputKind === 'list') {
					this.addField(name, values.map((v) => [v]))
				} else {
					for (const value of values) {
						this.addField(name, value)
					}
				}
			}
		}
	}

	/**
	 * @param {string} name
	 */
	addField(name, value = '') {
		const field = this.fields[name]
		if (!field) return
		if (!field.multiple) {
			const $field = this.querySelector(`[data-add-field="${name}"]`)
			if ($field) $field.setAttribute('hidden', '')
		}
		const id = idCounter++
		const removeButton = h(
			'button',
			{
				className: '<a> unbutton',
				'@aria-labelledby': `vh-${name}-${id} edit-${name}-${id}`,
				onclick() {
					this.closest('post-editor').removeField(this.closest('p'))
				},
			},
			h('span', { hidden: true, id: `vh-${name}-${id}` }, 'Remove'),
			h('span', { ariaHidden: true }, '×'),
		)

		switch (field?.inputKind) {
			case 'text':
				this.fieldsDiv.append(
					h(
						'p',
						{ '@data-field': name, className: 'grid-row' },
						removeButton,
						h(
							'label',
							{ '@data-cols': 2, htmlFor: `edit-${name}-${id}` },
							field.label,
						),
						h('input', {
							'@data-cols': 3,
							type: 'text',
							id: `edit-${name}-${id}`,
							name,
							value,
						}),
					),
				)
				break

			case 'html':
				this.fieldsDiv.append(
					h(
						'p',
						{ '@data-field': name, className: 'grid-row' },
						removeButton,
						h(
							'label',
							{ '@data-cols': 2, htmlFor: `edit-${name}-${id}` },
							field.label,
						),
						h('textarea', {
							'@data-cols': 3,
							id: `edit-${name}-${id}`,
							name,
						}, value),
					),
				)
				break

			case 'list':
				this.fieldsDiv.append(
					h(
						'p',
						{ '@data-field': name, className: 'grid-row' },
						removeButton,
						h(
							'label',
							{ htmlFor: `edit-${name}-${id}` },
							field.label,
						),
						h(ListInput, {
							id: `edit-${name}-${id}`,
							'@fields': '=text;',
							'@name': name,
							'@value': JSON.stringify(value),
						}),
					),
				)
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

customElements.define('post-editor', PostEditor)
