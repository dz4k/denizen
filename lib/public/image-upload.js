/*
  Image upload element.

  Users can upload one or multiple images.
  Thumbnails will be shown for each image.
  Each thumbnail will have the option to add alt text.

  Usage:

      <image-upload name="photo">
      </image-upload>

  Pre-populated:

      <image-upload>
        <input type="hidden" name="photo"
          value="https://mysite.example/.blobs/5ff63215-d3a7-46ef-b5ea-899c67c18eaa">
      </image-upload>

  Multiple:

      <image-upload multiple>
        <input type="hidden" name="photo"
          value="https://mysite.example/.blobs/5ff63215-d3a7-46ef-b5ea-899c67c18eaa">
        <input type="hidden" name="photo"
          value="https://mysite.example/.blobs/355d8659-d656-4d88-af3f-83e423ab1e00">
      </image-upload>

  Form data:

      photo=https://mysite.example/.blobs/5ff63215-d3a7-46ef-b5ea-899c67c18eaa&
      photo[alt]=Alt text 1&
      photo=https://mysite.example/.blobs/355d8659-d656-4d88-af3f-83e423ab1e00&
      photo[alt]=&
      photo=https://mysite.example/.blobs/355d8659-d656-4d88-af3f-890436743089&
      photo[alt]=Alt text 3
*/

import { FormElementMixin } from "./form-element-mixin.js"
import { bind, LiveArray, NotifyMixin } from './signal.js'
import { h, useGlobalSheets } from './util.js'

class ImageValue extends NotifyMixin(Object) {
  /** @type {File | URL} */
  value

  /** @type {string?} */
  alt
}

export class ImageUpload extends FormElementMixin(HTMLElement) {
  /**
   * The list of images.
   * @type {LiveArray<ImageValue>}
   */
  images = new LiveArray()

  constructor () {
    super()
    this.attachShadow({ mode: 'open' })
    useGlobalSheets(this.shadowRoot)

    let $uploadLabel, $uploader, $thumbs
    this.shadowRoot.append(
      $thumbs = h('ul', {
        className: 'thumbs',
      }),
      $uploadLabel = h('label', {
        className: '<button> uploader-label',
      },
        'Add image',
        $uploader = h('input', {
          type: 'file',
          className: 'uploader (vh)',
          multiple: this.multiple,
          onchange: () => {
            this.addImages($uploader.files)
            $uploader.value = null
          },
        }),
      ),
    )

    this.images.changed.connect(({ added, removed }) => {
      for (let i = removed[0]; i < removed[1]; i++) {
        $thumbs.children[removed[0]].remove();
      }
      const add = added[2].map(this.mkThumb)
      if ($thumbs.children[added[0]]) $thumbs.children[added[0]].after(...add)
      else $thumbs.append(...add)

      $uploadLabel.toggleAttribute('hidden', !this.multiple && this.images.length > 0)
    })

    this.images.anyChanged.connect((_) => {
      this.value = this.formData()
    })

    // Load pre-populated images
    const srcs = this.querySelectorAll('input:not([name$="[alt]"])')
    const alts = this.querySelectorAll('input[name$="[alt]"]')
    const values = Array.from(srcs, (src, i) => {
      const rv = new ImageValue()
      rv.value = src.value
      rv.alt = alts[i]?.value || undefined
      return rv
    })
    this.images.push(...values)
    this.innerHTML = ''
  }

  /**
   * Create a thumbnail element for an image.
   * @param {ImageValue} img
   */
  mkThumb = (img) => {
    let $thumb, $img

    $thumb = h('li', { className: 'thumb' },
      $img = h('img', { className: 'img' }),
      h('div', { className: 'thumb-actions' },
        h('button', {
          type: 'button',
          className: 'osd thumb-action -alttext',
          onclick: () => this.showAltTextDialog(img),
        }, "Alt"),
        h('button', {
          type: 'button',
          className: 'osd thumb-action -removeimage',
          onclick: () => this.images.splice(this.images.indexOf(img), 1),
        }, "Remove"),
      ),
    )

    console.log(img)
    bind(img, 'value', $img, 'src', {
      transform: (val) => val instanceof Blob ? URL.createObjectURL(val) : val
    })
    bind(img, 'alt', $img, 'alt', {
      transform: (alt) => alt ?? ''
    })

    return $thumb
  }

  showAltTextDialog = (img) => {
    let $textarea
    const $dialog = h('dialog', {
      part: 'alt-text-dialog',
      onclose: () => $dialog.remove(),
    },
      h('form', { method: 'dialog', part: 'alt-text-form' },
        h('label', { part: 'alt-text-label' },
          'Alt text',
          $textarea = h('textarea', {
            part: 'alt-text-area',
            oninput: () => img.alt = $textarea.value,
          }, img.alt ?? ''),
        ),
        h('button', { type: 'submit', part: 'submit-alt-text' }, 'Save'),
      ),
    )
    this.shadowRoot.append($dialog)
    $dialog.showModal()
  }

  formData = () => {
    const name = this.name
    const rv = new FormData()
    for (const image of this.images) {
      rv.append(name, image.value)
      rv.append(name + '[alt]', image.alt ?? '')
    }
    return rv
  }

  addImages = (files) => {
    if (!this.multiple) {
      const image = new ImageValue()
      image.value = files[files.length - 1]
      this.images.splice(0, this.images.length, image)
      return
    }
    for (const file of files) {
      const image = new ImageValue()
      image.value = file
      this.images.push(image)
    }
  }

  get name() { return this.getAttribute('name') }

  get multiple() { return this.hasAttribute('multiple') }
}

customElements.define('image-upload', ImageUpload)
