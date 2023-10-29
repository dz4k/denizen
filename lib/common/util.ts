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
