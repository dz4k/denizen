import { crypto } from "https://deno.land/std@0.204.0/crypto/mod.ts";

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
	const hash = crypto.subtle.digestSync('SHA-1', new TextEncoder().encode(str))
	const num = new BigUint64Array(hash)[0]

	const range = max - min + 1
	const mappedNumber = Number((num % BigInt(range)) + BigInt(min))

	return mappedNumber
}
