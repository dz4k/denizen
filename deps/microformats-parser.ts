import { mf2 } from 'npm:microformats-parser'
import type { MF2Document } from '../lib/common/mf2.ts'

type ParseOptions = {
	html: string // the html to be parse
	baseUrl: string // a base URL to resolve any relative URL:s to
}

export const parseMicroformats = (
	{ html, baseUrl }: ParseOptions,
): MF2Document => mf2(html, { baseUrl }) as MF2Document
