import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { asyncIteratorToArray } from '../common/util.ts'

export const get = async (c: hono.Context<Env>) => {
	const files = await asyncIteratorToArray(c.var.storage.list())
	return c.render(<FileManager files={files} />)
}

const FileManager = ({ files }: { files: string[] }) => {
	const c = hono.useRequestContext<Env>()
	c.set('title', 'Files -- Denizen')
	return (
		<>
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
								<tr id={`file-${encodeURIComponent(file)}`}>
									<td>{file}</td>
									<td style='white-space: nowrap'>
										<a
											download={file}
											href={`/.denizen/storage?filename=${file}`}
											class='<button>'
										>
											Download
										</a>{' '}
										<form
											rel='swap-replaceWith'
											target={`file-${encodeURIComponent(file)}`}
											method='DELETE'
											action={`/.denizen/storage?filename=${file}`}
										>
											<button>Delete</button>
										</form>
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
		</>
	)
}
