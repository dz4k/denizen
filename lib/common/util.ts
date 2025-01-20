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

export const toScript = <TArgs extends unknown[] = []>(
  f: (...args: TArgs) => unknown,
  ...args: TArgs
) =>
  `<script>(${f.toString()})(${
    args.map((arg: unknown) => JSON.stringify(arg))
  })</script>`

export const clientRedirect = (path: string | URL) =>
  toScript((path) => location.assign(path), path.toString())

export const htmlStripTags = (html: string) =>
  html
    .replace(/<(?!\/?( )\\b)[^<>]+>/gm, '')
    .replace(/([\r\n]+ +)+/gm, '')

export const ByteLimitStream = class extends TransformStream<Uint8Array, Uint8Array> {
  total: number = 0

  constructor(public limit: number) {
    super({
      transform: (chunk, controller) => {
        this.total += chunk.length
        if (this.total > limit) controller.error(
          new Error(`Byte limit of ${limit} exceeded`)
        )
        controller.enqueue(chunk)
      }
    })
  }
}
