import { h, mkid } from './util.js'

export class ListInput extends HTMLElement {
	static observedAttributes = ['name']

	connectedCallback() {
		// TODO: make dynamic
		if (this.initialized) return
		this.initialized = true
		/**
		 * @type {{name: string, type: string, labelId: string}[]}
		 */
		this.fields = this.hasAttribute('fields') ? this.parseFields() : [
			{ name: 'key', type: 'text', label: 'Key', labelId: mkid() },
			{ name: 'value', type: 'text', label: 'Value', labelId: mkid() },
		]

		this.append(
			this.$items = h('ul'),
			// this.$addItem = h('button', { type: 'button' }, '+ Add item'),
			...this.fields.map((field) =>
				h('label', { hidden: true, id: field.labelId }, field.label)
			),
		)

		// this.$addItem.addEventListener('click', () => this.addItem())

		this.addEventListener('input', (e) => {
			const $item = e.target.closest('li')
			const isLast = $item.nextElementSibling === null
			if (!isLast) return

			const inputs = Array.from($item.querySelectorAll('input'))
			const isEmpty = !inputs.some((input) => input.value)
			if (!isEmpty) this.addItem()
		})

		if (this.getAttribute('value')) {
			for (
				const values of JSON.parse(this.getAttribute('value'))
			) {
				this.addItem(values)
			}
		}
		this.addItem()
	}

	attributeChangedCallback(name, oldValue, newValue) {
		if (name === 'name') {
			this.querySelectorAll(`[name^=${JSON.stringify(oldValue)}]`)
				.forEach(($node) => $node.name = $node.name.replace(oldValue, newValue))
		}
	}

	get name() {
		return this.getAttribute('name')
	}

	parseFields() {
		const list = new URLSearchParams(this.getAttribute('fields'))
		return Array.from(list, ([name, val]) => {
			const [type, label] = val.split(';')
			return { name, type, label, id: mkid() }
		})
	}

	labelId() {
		this.label = this.closest('label') ??
			this.getRootNode()
				.querySelector(`label[for=${JSON.stringify(this.id)}]`)
		return this.label.id ??= mkid()
	}

	createItem() {
		let $item
		return $item = h(
			'li',
			{},
			this.fields.map((field) => {
				return h('input', {
					type: field.type,
					name: `${this.name}[${field.name}]`,
					placeholder: field.label,
					'@aria-labelledby': `${this.labelId()} ${field.labelId}`,
				})
			}),
			' ',
			h('button', {
				type: 'button',
				onclick: () => this.removeItem($item),
				className: '<a> unlink',
				title: 'Remove',
				ariaLabel: 'Remove',
			}, '×'),
		)
	}

	addItem(values = []) {
		const $item = this.createItem()
		values.forEach((value, i) => $item.children[i].value = value)
		this.$items.append($item)
	}

	removeItem($item) {
		$item.remove()
		if (this.$items.childElementCount === 0) this.addItem()
	}
}

customElements.define('list-input', ListInput)
