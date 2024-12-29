import * as hono from '../../deps/hono.ts'
import type { Env } from '../denizen.ts'

import { getBlogImportJob, saveBlogImportJob } from '../db.ts'
import { enqueue } from '../queue.ts'
import { clientRedirect } from '../common/util.ts'
import { Layout } from '../layout.ts'
import { BlogImportJob } from '../import-blog.ts'

export const get = (c: hono.Context<Env>) => {
	return c.render(<ImportForm />)
}

export const post = async (c: hono.Context<Env>) => {
	const body = await c.req.parseBody()
	if (typeof body['feed-url'] !== 'string') {
		return c.render(<ImportForm error='Please specify an URL' />)
	}
	let feedUrl
	try {
		feedUrl = new URL(body['feed-url'])
	} catch {
		return c.render(<ImportForm error='Invalid feed URL' />)
	}

	const job = await saveBlogImportJob({
		feedUrl: feedUrl.href,
		status: 'starting',
	})
	await enqueue({
		type: 'import_blog',
		job,
	})
	return c.html(clientRedirect(`/.denizen/import-blog/${job.id}`))
}

export const getJob = async (c: hono.Context<Env>) => {
  const jobId = c.req.param("id")
  const job = await getBlogImportJob(jobId)
  return c.render(<JobPage job={job} />)
}

export const ImportForm = (p: { error?: string }) => {
	const c = hono.useRequestContext<Env>()
	if (p.error) c.status(400)
	return (
		<section id='sect-import-form'>
			<h2>Import blog to Denizen</h2>
			<main>
				<form
					rel='swap-replaceWith'
					target='#sect-import-form'
					method='POST'
					action='/.denizen/import-blog'
					class='grid'
					style='grid: auto-flow / auto 1fr'
				>
					{p.error
						? (
							<div class='bad' style='grid-column: 1/span 2'>
								<p>{p.error}</p>
							</div>
						)
						: ''}
					<p class='grid-row'>
						<label for='feed-url'>Feed URL</label>
						<span class='grid'>
							<input
								type='url'
								name='feed-url'
								id='feed-url'
								aria-describedby='feed-url-desc'
							/>
							<span id='feed-url-desc' class='<small>'>
								Enter a RSS, Atom or JSONFeed URL for your old blog.
							</span>
						</span>
					</p>
					<p class='grid-row'>
						<span />
						<span>
							<button class='big'>Import</button>
						</span>
					</p>
				</form>
				<p>
					Denizen can import your posts from an old blog using an RSS, Atom or
					JSONFeed feed.
				</p>
			</main>
		</section>
	)
}

export const JobPage = (p: { job: BlogImportJob }) => {
  const job = p.job
  return (
    <>
      <h1>Blog import</h1>
      <table>
        <tr>
          <th scope="row">Importing from</th>
          <td>{job.feedUrl}</td>
        </tr>
        <tr>
          <th scope="row">Posts to import</th>
          <td>{job.totalPosts}</td>
        </tr>
        <tr>
          <th scope="row">Posts imported</th>
          <td>{job.importedPosts}</td>
        </tr>
        <tr>
          <th scope="row">Posts failed</th>
          <td>{job.failedPosts}</td>
        </tr>
      </table>
      {job.errors ?
        <div class="bad">
          <h2>Errors</h2>
          <ul>
            {job.errors.map(err => (
              <li>{err}</li>
            ))}
          </ul>
        </div>
      : ""}
    </>
  )
}
