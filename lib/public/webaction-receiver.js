if (window.parent !== window) {
	window.parent.postMessage(
		JSON.stringify({
			reply:
				new URL('/.denizen/post/new?in-reply-to={url}', window.location.href)
					.href,
		}),
	)
}
