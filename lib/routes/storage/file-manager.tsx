/** @jsx hono.h */
/** @jsxFrag hono.fragment */

import * as hono from '../../../deps/hono.ts'
import type { Env } from '../../denizen.ts'
import { Layout } from '../../layout.ts'

import { asyncIteratorToArray } from '../../common/util.ts'
import * as storage from '../../storage.ts'

export const get = async (c: hono.Context<Env>) => {
	const files = await asyncIteratorToArray(storage.list())
	return c.html(<FileManager files={files} />)
}

const FileManager = ({ files }: { files: string[] }) => (
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
