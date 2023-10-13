export class KeyValueInput extends HTMLElement {
	static observedAttributes = ['name']

	constructor() {
		super()

		// TODO: make dynamic
		this.keyType = this.getAttribute('keytype') ?? 'text'
		this.valueType = this.getAttribute('valuetype') ?? 'text'

		this.label = this.closest('label') ??
			this.getRootNode()
				.querySelector(`label[for=${JSON.stringify(this.id)}]`)
		this.labelId = this.label.id ??= id()

		this.append(
			this.$items = h('ul'),
			this.$addItem = h('button', { type: 'button' }, '+'),
		)

		this.$addItem.addEventListener('click', () => this.addItem())

		if (this.hasAttribute('value')) {
			for (
				const [name, value] of Object.entries(
					JSON.parse(this.getAttribute('value')),
				)
			) {
				this.addItem(name, value)
			}
		} else this.addItem()
	}

	attributeChangedCallback(name, oldValue, newValue) {
		this.querySelectorAll(`[name^=${JSON.stringify(oldValue)}]`)
			.forEach(($node) => $node.name = $node.name.replace(oldValue, newValue))
	}

	get name() {
		return this.getAttribute('name')
	}

	createItem() {
		let $item
		const keyLabelId = id(), valueLabelId = id()
		return $item = h(
			'li',
			{},
			h('input', {
				type: this.keyType,
				name: this.name + '[key]',
				'@aria-labelledby': `${this.labelId} ${keyLabelId}`,
			}),
			' ',
			h('input', {
				type: this.valueType,
				name: this.name + '[value]',
				'@aria-labelledby': `${this.labelId} ${valueLabelId}`,
			}),
			' ',
			h('button', {
				type: 'button',
				onclick: () => this.removeItem($item),
				title: 'Remove',
				ariaLabel: 'Remove',
			}, '×'),
			h('span', {
				hidden: true,
				id: keyLabelId,
			}, 'key'),
			h('span', {
				hidden: true,
				id: valueLabelId,
			}, 'value'),
		)
	}

	addItem(name = '', value = '') {
		const $item = this.createItem()
		$item.children[0].value = name
		$item.children[1].value = value
		this.$items.append($item)
	}

	removeItem($item) {
		$item.remove()
	}
}

customElements.define('kv-input', KeyValueInput)

/**
 * @param {string} name Tag name
 * @param {Partial<>} props Properties
 * @param  {...(Node | string)[]} children Child nodes
 * @returns {Element}
 */
function h(name, props = {}, ...children) {
	const $el = document.createElement(name)
	for (const prop in props) {
		if (prop.startsWith('@')) $el.setAttribute(prop.slice(1), props[prop])
		else $el[prop] = props[prop]
	}
	$el.append(...children)
	return $el
}

function id() {
	return 'id' + Math.floor(Math.random() * (36 ** 6)).toString(36)
}
