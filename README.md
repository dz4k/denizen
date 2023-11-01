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
  - [X] https://webmention.rocks/ Pass all discovery tests
  - [X] https://webmention.rocks/update/1
  - [X] https://webmention.rocks/update/2 notify URLs that have been removed
        from a post
  - [X] https://webmention.rocks/delete/1
- [X] Webmention receiving
  - [X] https://webmention.rocks/ Pass all receiver tests
  - [X] delete existing webmention if mentioning link was removed
- [X] IndieAuth
- [X] Micropub
  - [X] Posting
  - [ ] Media endpoint (waiting on blob storage)
  - [X] Updating
  - [X] Deleting
  - [X] Undeleting
- [ ] Fetching link embeds
- [ ] Syndication to social media silos
- [ ] ActivityPub maybe?
- [X] Settings UI (instead of config.ts)
- [ ] Intl
  - [ ] Translating the Denizen UI
  - [ ] Multilingual sites
- [ ] Plugin system
