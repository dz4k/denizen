import { crypto } from 'https://deno.land/std@0.204.0/crypto/mod.ts'
import { unknown } from '../../deps/zod.ts'

export const asyncIteratorToArray = async <T>(
	it: AsyncIterable<T>,
): Promise<T[]> => {
	const rv: T[] = []
	for await (const x of it) rv.push(x)
	return rv
}

export const isValidUrl = (string: unknown): string is string | URL => {
	try {
		new URL(string as string)
		return true
	} catch {
		return false
	}
}

export const stringToRandNumber = (
	str: string,
	[min, max]: [number, number],
) => {
	const buf = new TextEncoder().encode(str)
	const hash = crypto.subtle.digestSync('SHA-1', buf)
	const bu64a = new BigUint64Array(hash.slice(0, 8))
	const num = bu64a[0]

	const range = max - min + 1
	const mappedNumber = Number((num % BigInt(range)) + BigInt(min))

	return mappedNumber
}

export const toScript = <TArgs extends unknown[] = []>(
	f: (...args: TArgs) => unknown,
	...args: TArgs
) =>
	`<script>(${f.toString()})(${
		args.map((arg: unknown) => JSON.stringify(arg))
	})</script>`

export const clientRedirect = (path: string | URL) =>
	toScript((path) => location.assign(path), path.toString())
