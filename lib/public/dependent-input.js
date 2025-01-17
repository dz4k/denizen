export class DependentInput extends HTMLElement {
	constructor() {
		super()

		this.update()
		this.addEventListener('change', this.update)
	}

	update = () => {
		const input = this.querySelector('select, input[type=radio]:checked')
		const selectedValue = input.dataset.controls ??
			input.selectedOptions[0].dataset.controls
		const values = getValues(input)
		console.log({ values, selectedValue })
		values.forEach((value) => {
			const el = document.getElementById(value)
			if (!el) {
				console.warn(
					'<dependent-input>: nonexistent element referenced:',
					value,
				)
				return
			}
			el.disabled = el.hidden = value !== selectedValue
		})
	}
}

const getValues = (el) =>
	Array.from(getOptions(el), (opt) => opt.dataset.controls)
const getOptions = (el) => {
	if (el instanceof HTMLSelectElement) return el.options
	if (el instanceof HTMLInputElement && el.type === 'radio') {
		return (el.form ?? document)
			.querySelectorAll(`input[type=radio][name=${el.name}]`)
	}
}

customElements.define('dependent-input', DependentInput)
