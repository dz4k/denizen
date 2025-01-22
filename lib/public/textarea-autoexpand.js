if (!CSS.supports('field-sizing', 'content')) {
  document.querySelectorAll('textarea').forEach(($el) => {
    if (getComputedStyle(el).getPropertyValue('field-sizing') === 'content') {
      const update = () => {
        $el.style.height = ''
        $el.style.height = $el.scrollHeight + 'px'
   	}

    $el.style.boxSizing = 'border-box'
    update()
    $el.addEventListener('input', update)
    }
  })
}
