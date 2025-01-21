/// <reference lib="dom" />

import { htmlescape } from './util.js'

export class ImageDropZone extends HTMLElement {
  constructor() {
    super()
    this.addEventListener('dragover', this.dragOver)
    this.addEventListener('drop', this.drop)
    this.addEventListener('image-drop-zone:uploaded', this.insert)
  }
  dragOver = (e) => {
    console.log("Drag Over", e)
    e.preventDefault()
  }

  /**
   * @param {DragEvent} e
   */
  drop = async (e) => {
    console.log("Drop", e)
    if (!e.dataTransfer?.items) return

    for (const item_ of e.dataTransfer.items) {
      const item = /** @type {DataTransferItem} */ (item_)
      if (item.kind !== 'file') continue
      const file = item.getAsFile()
      const formdata = new FormData()
      formdata.set('file', file)
      formdata.set('cache-control', 'public, max-age=31536000, immutable')
      const upload = new Request(
        "/.denizen/storage",
        {
          method: 'POST',
          body: formdata,
          headers: { 'Accept': 'application/json' },
        }
      )
      try {
        const res = await fetch(upload)
        if (!res.ok) {
          this.dispatchEvent(
            new CustomEvent('image-drop-zone:error', {
              detail: { error: res.statusText }
            })
          )
          return
        }
        const { url } = await res.json()
        this.dispatchEvent(new CustomEvent('image-drop-zone:uploaded', {
          detail: { url }
        }))
      } catch (e) {
        this.dispatchEvent(new CustomEvent('image-drop-zone:error', {
          detail: { error: e }
        }))
      }
    }
  }

  insert = (e) => {
    const dest = this.querySelector('textarea, input')
    if (!dest) return
    const url = e.detail.url
    const html = `<img src="${htmlescape(url)}" alt="">`
    insert(dest, html)
  }
}

const insert = (el, text) => {
  const start = el.selectionStart, end = el.selectionEnd
  el.value = el.value.substring(0, start) + text + el.value.substring(end)
  el.selectionStart = el.selectionEnd = start + text.length
  el.focus()
}

customElements.define('image-drop-zone', ImageDropZone)
