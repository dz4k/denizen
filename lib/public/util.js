/**
 * @template T
 * @typedef {(T | Tree<T>)[]} Tree<T>
 */

/**
 * @param {string | Function} name Tag name
 * @param {Partial<>} props Properties
 * @param  {Tree<Node | string>} children Child nodes
 * @returns {Element}
 */
export const h = (name, props = {}, ...children) => {
	const $el = typeof name === 'string'
		? document.createElement(name)
		: new name()
	for (const prop in props) {
		if (prop.startsWith('@')) $el.setAttribute(prop.slice(1), props[prop])
		else $el[prop] = props[prop]
	}
	$el.append(...children.flat())
	return $el
}

export const mkid = () =>
	'id' + Math.floor(Math.random() * (36 ** 6)).toString(36)

export const htmlescape = (v) =>
  String(v).replace(/<>&'"/g, s => `&#${s.charCodeAt(0)};`)
