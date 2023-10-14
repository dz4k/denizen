import { getConfig } from './db.ts'

export const baseUrl = new URL(
	await getConfig('base url') as string ?? 'https://denizaksimsek.com',
)
export const locales = await getConfig('locales') as string[] ?? ['en-US']
