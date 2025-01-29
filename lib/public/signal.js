/**
 * a GObject-style signal
 */
export const Signal = class {
  #listeners = new Set()

  #blocked = false

  raise(...args) {
    if (this.#blocked) return undefined
    let rv
    this.#listeners.forEach(listener => rv = listener(...args))
    return rv
  }

  connect(fn) {
    this.#listeners.add(fn)
  }

  disconnect(fn) {
    this.#listeners.delete(fn)
  }

  block() {
    this.#blocked = true
  }

  unblock() {
    this.#blocked = false
  }
}

/**
 * @template {string} State
 */
export const StateMachine = class {
  /**
   * @type {State[]}
   */
  stateSpace

  transition = new Signal()

  /**
   * @type {Record<State, Signal>}
   */
  transitionFrom

  /**
   * @type {Record<State, Signal>}
   */
  transitionTo

  /**
   * @type {string}
   */
  #state

  construct(stateSpace) {
    this.stateSpace = stateSpace
    this.transitionFrom = Object.fromEntries(
      stateSpace.map(state => [state, new Signal()])
    )
    this.transitionTo = Object.fromEntries(
      stateSpace.map(state => [state, new Signal()])
    )
  }

  get state() {
    return this.#state
  }

  set state(value) {
    const oldState = this.#state
    this.#state = value
    this.transitionFrom[oldState].raise()
    this.transitionTo[value].raise()
    this.transition.raise()
  }
}

/**
 * @template T
 * @param {T} obj
 * @param {keyof T} props
 * @returns {{ [k: keyof T]: Signal }}
 */
export const notify = (obj, props = Object.getOwnPropertyNames(obj)) => {
  const rv = {}
  props.forEach(prop => {
    rv[prop] = new Signal()
    let value = obj[prop]
    Object.defineProperty(obj, prop, {
      get() {
        return value
      },
      set(newValue) {
        const oldValue = value
        if (newValue === oldValue) return
        value = newValue
        rv[prop].raise(oldValue, newValue)
      },
    })
  })
  return rv
}

export const NotifyMixin = (Super) => class extends Super {
  #notify;
  get notify() { return this.#notify ??= notify(this) }
}

/**
 * @template TSrc
 * @template TDest
 * @param {TSrc} srcObj
 * @param {keyof TSrc} srcProp
 * @param {TDest} destObj
 * @param {keyof TDest} destProp
 * @param {object} options
 * @param {(s: any) => any} transform
 */
export const bind = (srcObj, srcProp, destObj, destProp = srcProp, {
  transform = x => x
} = {}) => {
  destObj[destProp] = transform(srcObj[srcProp])
  srcObj.notify[srcProp].connect((_, newValue) =>
    destObj[destProp] = transform(newValue))
}

/**
 * @param {EventTarget} target
 * @param {String} name
 * @returns {Signal}
 */
export const event = (target, name) => {
  const rv = new Signal()
  target.addEventListener(name, e => rv.raise(e))
  return rv
}

export class LiveArray {
  #array = []
  changed = new Signal()
  notify = { length: new Signal() }

  constructor(...args) {
    this.#array = args
  }

  splice(start, deleteCount, ...items) {
    const added = items
    const removed = this.#array.splice(start, deleteCount, ...items)
    this.changed.raise({ added: [start, start + items.length, added], removed: [start, start + deleteCount, removed] })
    this.notify.length.raise(length - deleteCount + items.length, length)
  }

  get length() { return this.#array.length }
  at(index) { return this.#array.at(index) }

  set(index, value) { this.splice(index, 1, value) }
  push(...items) { this.splice(this.length, 0, ...items) }
  pop() { return this.splice(this.length - 1, 1)[0] }
  shift() { return this.splice(0, 1)[0] }
  unshift(...items) { this.splice(0, 0, ...items) }

  [Symbol.iterator]() { return this.#array[Symbol.iterator]() }
  forEach(fn) { return this.#array.forEach(fn) }
  map(fn) { return this.#array.map(fn) }
  filter(fn) { return this.#array.filter(fn) }
  reduce(fn, initialValue) { return this.#array.reduce(fn, initialValue) }
  every(fn) { return this.#array.every(fn) }
  some(fn) { return this.#array.some(fn) }
  find(fn) { return this.#array.find(fn) }
  findIndex(fn) { return this.#array.findIndex(fn) }
  includes(value) { return this.#array.includes(value) }
  indexOf(value) { return this.#array.indexOf(value) }
  lastIndexOf(value) { return this.#array.lastIndexOf(value) }
  join(separator) { return this.#array.join(separator) }
  slice(start, end) { return this.#array.slice(start, end) }
  concat(...arrays) { return this.#array.concat(...arrays) }

  reverse() {
    this.#array.reverse()
    this.changed.raise({ added: [0, this.length, this.#array], removed: [0, this.length] })
  }

  sort(compareFn) {
    this.#array.sort(compareFn)
    this.changed.raise({ added: [0, this.length, this.#array], removed: [0, this.length] })
  }
}
