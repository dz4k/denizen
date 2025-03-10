# Denizen

_Denizen is a personal website engine that connects you to the IndieWeb and
Fediverse on your own terms._

A CMS written in Deno, aiming to be one-click deployable.

## Run locally

~~~
deno task dev
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
- [X] Import from RSS feed
  - [ ] Test on multiple blogs
  - [ ] Show import progress
- [X] Webmention sending
- [X] Webmention receiving
- [X] IndieAuth
- [X] Micropub
  - [X] Media endpoint ~~(waiting on blob storage)~~
- [ ] Media processing (image resizing, etc.)
- [ ] Fetching link embeds
- [ ] Syndication to social media silos
- [ ] Microsub
  - [ ] Collecting subscriptions
  - [ ] Fetching posts
    - [ ] RSS
    - [ ] JSON Feed
    - [ ] Microformats
    - [ ] ActivityStreams?
    - [ ] WebSub
- [ ] WebSub publishing
- [ ] ActivityPub maybe?
- [X] Settings UI (instead of config.ts)
- [ ] Intl
  - [ ] Translating the Denizen UI
  - [ ] Multilingual sites
- [ ] Plugin system
