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
- [ ] Editing posts
- [ ] Post editor
  - [ ] Markdown and WYSIWYG support
- [X] Authentication for post editor
- [ ] File upload & image optimization
  - [X] Upload files
  - [X] Delete files
  - [ ] Edit code files (CSS, JS etc.) in the web UI
  - [X] File metadata (MIME type, date created/changed)
  - [ ] Wait for Deno KV blob storage
- [ ] Webmention sending
- [ ] Webmention receiving
- [X] IndieAuth
- [ ] Micropub
  - [ ] Posting
  - [ ] Media endpoint
  - [ ] Updating and deleting
  - [ ] Undeleting?
- [ ] Fetching link embeds
- [ ] ActivityPub maybe?
- [ ] Settings UI (instead of config.ts)
- [ ] Plugin system
