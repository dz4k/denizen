class WebactionButton extends HTMLElement {
	constructor() {
		super()
		this.onclick = this.doAction
	}

	doAction = async (e) => {
		console.log('doAction')

		if (!e.target.closest('button')) return

		// Load reader's indie-config
		const config = await new Promise((resolve, reject) => {
			const iframe = document.createElement('iframe')
			iframe.src = 'web+action:load'
			iframe.hidden = true
			document.body.append(iframe)

			const signal = AbortSignal.timeout(5000)

			window.addEventListener('message', function listener(e) {
				if (e.source !== iframe.contentWindow) return
				window.removeEventListener('message', listener)
				iframe.remove()
				resolve(JSON.parse(e.data))
			}, { signal })

			signal.addEventListener('abort', () => {
				iframe.remove()
				reject(new Error('Timeout'))
			}, { once: true })
		})
		console.log('config', config)

		const action = this.getAttribute('action') ?? 'reply'
		location = config[action].replace('{url}', location.href)
	}
}

customElements.define('denizen-webaction', WebactionButton)
