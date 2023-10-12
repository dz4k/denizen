/** @jsx jsx */
/** @jsxFrag Fragment */

// TODO: Rewrite in Deno KV blob storage when that becomes a thing.

import * as path from 'https://deno.land/std@0.203.0/path/mod.ts'

import { Hono, jsx } from '../deps/hono.ts'

import { Env } from './server.tsx'
import { requireAdmin } from './admin.tsx'
import { asyncIteratorToArray } from './util.ts'
import { Layout } from './ui.tsx'

export const read = async (name: string): Promise<Blob> =>
	new Blob([await Deno.readFile(encode(name))], {
		type: await Deno.readTextFile(encode(name) + '.#type'),
	})

export const write = async (name: string, blob: Blob): Promise<void> => {
	await Deno.mkdir(blobDir, { recursive: true })
	await Deno.writeTextFile(encode(name) + '.#type', blob.type)
	return Deno.writeFile(encode(name), blob.stream())
}
export const list = async function* () {
	await Deno.mkdir(blobDir, { recursive: true })
	for await (const entry of Deno.readDir(blobDir)) {
		if (entry.name.endsWith('.#type')) continue
		yield decodeURIComponent(entry.name)
	}
}
export const del = (name: string) => Deno.remove(encode(name))

const blobDir = '_blobs'
const encode = (s: string) => path.join(blobDir, encodeURIComponent(s))

// #region Web

export default function installStorage(app: Hono<Env>) {
	app.get('/storage/:filename{.+}', async (c) => {
		const filename = c.req.param('filename')
		if (!filename) return c.body('', 400)
		try {
			const blob = await read(filename)
			console.log(blob)
			return c.body(blob.stream(), 200, {
				'Content-Type': blob.type,
			})
		} catch {
			return c.body('', 404)
		}
	})

	app.delete('/storage/:filename{.+}', requireAdmin, async (c) => {
		const filename = c.req.param('filename')
		if (!filename) return c.body('', 400)
		try {
			await del(filename)
			return c.body('', 200)
		} catch {
			return c.body('', 404)
		}
	})

	app.post('/storage/:filename{.+}', requireAdmin, async (c) => {
		const filename = c.req.param('filename')

		await write(filename, await c.req.blob())
		return c.redirect('/.denizen/files')
	})

	app.post('/storage', requireAdmin, async (c) => {
		const formdata = await c.req.formData()

		const file = formdata.get('file')
		if (!file || !(file instanceof File)) return c.body('No file!', 400)
		await write(file.name, file)
		return c.redirect('/.denizen/files')
	})

	app.all('/storage', (c) => {
		const filename = c.req.query('filename')
		if (!filename) return c.body('', 400)
		return c.redirect('/.denizen/storage/' + encodeURIComponent(filename), 308)
	})

	app.get('/files', requireAdmin, async (c) => {
		const files = await asyncIteratorToArray(list())
		return c.html(<FileManager files={files} />)
	})
}

export const FileManager = ({ files }: { files: string[] }) => (
	<Layout title='Files -- Denizen'>
		<header>
			<h1>Files</h1>
		</header>
		<main>
			{files.length
				? (
					<table style='width: 100%'>
						<col />
						<col width='0.1%' />
						<thead>
							<tr>
								<th>Filename</th>
								<th>Actions</th>
							</tr>
						</thead>
						{files.map((file) => (
							<tr>
								<td>{file}</td>
								<td style='white-space: nowrap'>
									<a
										download={file}
										href={`/.denizen/storage?filename=${file}`}
										class='<button>'
									>
										Download
									</a>{' '}
									<button
										hx-delete={`/.denizen/storage?filename=${file}`}
										hx-target='closest tr'
									>
										Delete
									</button>
								</td>
							</tr>
						))}
					</table>
				)
				: <p class='center big'>No files</p>}

			<h2>Add file</h2>
			<form
				action='/.denizen/storage'
				method='POST'
				enctype='multipart/form-data'
				class='table rows'
			>
				<label>
					<span>File</span>
					<input type='file' name='file' />
				</label>
				<button type='submit'>Upload</button>
			</form>
		</main>
	</Layout>
)

// #endregion
