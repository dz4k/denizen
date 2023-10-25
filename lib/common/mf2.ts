import { z } from '../../deps/zod.ts'

export const MF2Html = z.object({
	html: z.string(),
	value: z.string().optional(),
})
export type MF2Html = z.infer<typeof MF2Html>

export const MF2PropertyValue: z.ZodType<MF2PropertyValue> = z.union([
	z.string(),
	MF2Html,
	z.lazy(() => MF2Object),
])
// Cannot z.infer
export type MF2PropertyValue = string | MF2Html | MF2Object

export const MF2Properties: z.ZodType<MF2Properties> = z.record(
	z.array(MF2PropertyValue).nonempty(),
)
// Cannot z.infer
export type MF2Properties = Record<string, MF2PropertyValue[]>

export const MF2Object = z.object({
	type: z.string().array().nonempty(),
	value: z.string().optional(),
	properties: MF2Properties,
})
// Cannot z.infer
export type MF2Object = {
	type: string[]
	value?: string | undefined
	properties: MF2Properties
}

export const mf2String = (value: MF2PropertyValue): string => {
	if (typeof value === 'string') return value
	if ('html' in value) return value.html
	if ('value' in value && typeof value.value === 'string') return value.value
	return ''
}

export const mf2Strings = function* (
	values: MF2PropertyValue[],
): Iterable<string> {
	for (const value of values) {
		if (typeof value === 'string') yield value
		else if ('value' in value && typeof value.value === 'string') {
			yield value.value
		}
	}
}

export const mf2StringArray = (values: MF2PropertyValue[]): string[] =>
	Array.from(mf2Strings(values))

export const mf2Url = (value: MF2PropertyValue): URL =>
	new URL(mf2String(value))

export const mf2Urls = function* (values: MF2PropertyValue[]): Iterable<URL> {
	for (const value of values) {
		try {
			yield mf2Url(value)
		} catch {
			// nothing
		}
	}
}

export const mf2UrlArray = (values: MF2PropertyValue[]): URL[] =>
	Array.from(mf2Urls(values))

export const mf2Date = (value: MF2PropertyValue): Date =>
	new Date(Date.parse(mf2String(value)))

/**
 * Mutates object!
 */
export const removeEmptyProperties = (ob: MF2Object): MF2Object => {
	for (const prop in ob.properties) {
		if (ob.properties[prop].length === 0) delete ob.properties[prop]
	}
	return ob
}
