import { getConfigs } from './db.ts'

const configs = await getConfigs()

export const baseUrl = new URL(
	await configs['base url'] as string ?? 'https://denizaksimsek.com',
)
export const locales = configs['locales'] as string[] ?? ['en-US']

export const themes = {
	default: { name: 'Default' },
	altai: { name: 'Altai' },
} as const

export const theme = configs['theme'] as keyof typeof themes
