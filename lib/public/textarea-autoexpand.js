document.querySelectorAll('textarea[data-autoexpand]').forEach(($el) => {
	const update = () => {
		$el.style.height = ''
		$el.style.height = $el.scrollHeight + 'px'
	}

	$el.style.boxSizing = 'border-box'
	update()
	$el.addEventListener('input', update)
})
