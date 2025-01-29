
/**
 * @template T
 * @param {T} Super
 * @returns {T}
 */
export const FormElementMixin = (Super) => class extends Super {
  static formAssociated = true
  #internals = this.attachInternals()
  #value = ""
  get value() { return this.#value }
  set value(value) { this.#internals.setFormValue(this.#value = value) }
  get form() { return this.#internals.form }
  get name() { return this.getAttribute('name') }
  get type() { return this.localName }
  get validity() { return this.#internals.validity }
  get validationMessage() { return this.#internals.validationMessage }
  get willValidate() { return this.#internals.willValidate }
  checkValidity() { return this.#internals.checkValidity() }
  reportValidity() { return this.#internals.reportValidity() }
}
