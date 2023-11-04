# Denizen

_Denizen is a personal website engine that connects you to the IndieWeb and
Fediverse on your own terms._

A CMS written in Deno, aiming to be one-click deployable.

## Run locally

~~~
bin/denizen.tsx
~~~

## TODO

(Incomplete list)

- [X] Posting
- [X] Deleting posts
- [X] Editing posts
- [ ] Post editor
  - [ ] Markdown and WYSIWYG support
- [X] Authentication for post editor
- [ ] File upload & image optimization
  - [X] Upload files
  - [X] Delete files
  - [ ] Edit code files (CSS, JS etc.) in the web UI
  - [X] File metadata (MIME type, date created/changed)
  - [ ] Wait for Deno KV blob storage
- [ ] Import from RSS feed
- [X] Webmention sending
- [X] Webmention receiving
- [X] IndieAuth
- [X] Micropub
  - [ ] Media endpoint (waiting on blob storage)
- [ ] Fetching link embeds
- [ ] Syndication to social media silos
- [ ] ActivityPub maybe?
- [X] Settings UI (instead of config.ts)
- [ ] Intl
  - [ ] Translating the Denizen UI
  - [ ] Multilingual sites
- [ ] Plugin system
