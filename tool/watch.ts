#!/usr/bin/env -S deno run -A

// #region Config

const shouldRestart = (path: string) =>
	[
		/build\//,
		/doc\//,
		/_blobs\//,
		/\.git\//,
		/\.sqlite/,
	].every((re) => !re.test(path))

const ilog = <T>(...args: [...unknown[], T]): T => {
	console.log(
		'%cwatch.ts:%c %s',
		'color: blue',
		'color: inherit; font-weight: bold;',
		...args,
	)
	return args[args.length - 1] as T
}

// #endregion

// #region Server

let server: Deno.ChildProcess
let abortCtl: AbortController

const spawn = () => {
	console.log('Starting server')
	server = new Deno.Command(
		'bin/denizen.ts',
		{
			env: { DENIZEN_KV: 'dev.sqlite' },
			signal: (abortCtl = new AbortController()).signal,
		},
	).spawn()
	server.ref()
}

const kill = async () => {
	ilog('Killing server')
	try {
		abortCtl?.abort()
		await server.output()
	} catch {
		// ignore
	}
}

// #endregion

// #region Watcher

const debounce = (fn: () => void, ms: number) => {
	let timeout: number
	return () => {
		clearTimeout(timeout)
		timeout = setTimeout(fn, ms)
	}
}

const restart = debounce(async () => {
	await kill()
	await spawn()
}, 100)

await spawn()

for await (const event of Deno.watchFs('.', { recursive: true })) {
	pathLoop: for (const path of event.paths) {
		if (shouldRestart(path)) {
			restart()
			break pathLoop
		}
	}
}

// #endregion
