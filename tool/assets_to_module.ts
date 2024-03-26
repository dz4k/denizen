import * as path from 'https://deno.land/std@0.203.0/path/mod.ts'
import { encodeBase64 } from 'https://deno.land/std@0.203.0/encoding/base64.ts'

const files = <Record<string, string>> {}

for await (const entry of Deno.readDir('lib/public')) {
	if (!entry.isFile) continue
	files[entry.name] = encodeBase64(
		await Deno.readFile(path.join('lib/public', entry.name)),
	)
}

await Deno.mkdir('build', { recursive: true })
await Deno.writeTextFile('build/assets.json', JSON.stringify(files))
