import lume from 'lume/mod.ts'
import date from 'lume/plugins/date.ts'
import code_highlight from 'lume/plugins/code_highlight.ts'
import multilanguage from 'lume/plugins/multilanguage.ts'
import prism from 'lume/plugins/prism.ts'
import sitemap from 'lume/plugins/sitemap.ts'
import vento from 'lume/plugins/vento.ts'

import { getGitDate } from 'lume/core/utils/date.ts'

import 'npm:prismjs@1.29.0/components/prism-bash.js'
import { container } from 'npm:@mdit/plugin-container'

const site = lume({}, {
  markdown: {
    options: {
      typographer: true
    },
    plugins: [
      [container, {
        name: "warn"
      }]
    ],
  },
})

site.remoteFile('/css/vendor/siimple-icons.css',
  'https://cdn.jsdelivr.net/npm/siimple-icons/siimple-icons.css',)

site.loadPages(['.html'])
site.copy('/fonts')
site.copy('/media')
site.copy('/css')

site.use(date())
site.use(code_highlight())
site.use(multilanguage({ languages: ['en'] }))
site.use(prism({ cssSelector: 'pre' }))
site.use(sitemap())
site.use(vento())

site.data('layout', 'layout.vto')
site.data('date', 'git created')
site.preprocess(
  ['.html'],
  (pages) =>
    pages.forEach((page) => {
      page.data.modified = getGitDate('modified', page.src.entry?.src!)
    }),
)

export default site
