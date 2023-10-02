export const asyncIteratorToArray = async <T>(
	it: AsyncIterable<T>,
): Promise<T[]> => {
	const rv: T[] = []
	for await (const x of it) rv.push(x)
	return rv
}
