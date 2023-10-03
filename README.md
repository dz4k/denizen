# Denizen

_Denizen is a personal website engine that connects you to the IndieWeb and
Fediverse on your own terms._

A CMS written in Deno, aiming to be one-click deployable.

## Run locally

~~~
bin/denizen.tsx
~~~

I recommend [denon][] for editing code and testing it:

~~~
denon bin/denizen.tsx
~~~

[denon]: https://deno.land/x/denon@2.5.0

## TODO

(Incomplete list)

- [X] Posting
- [X] Deleting posts
- [ ] Editing posts
- [ ] Post editor
  - [ ] Markdown and WYSIWYG support
- [X] Authentication for post editor
- [ ] File upload & image optimization
- [ ] Webmention sending
- [ ] Webmention receiving
- [ ] Fetching link embeds
- [ ] ActivityPub maybe?
- [ ] Settings UI (instead of config.ts)
