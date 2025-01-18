---
title: Get started
---

##      Install


<details open name="how-to-run">
<summary>Run on your own server or personal computer</summary>

You can run Denizen locally on your computer or on a server by downloading a binary release from
[our Codeberg releases page]

  ~~~~ sh
  ./denizen-v.0.0.0-devel.1-unknown-linux-gnu
  ~~~~

</details>

<details name="how-to-run">
<summary>Run on Deno Deploy</summary>

Currently, running Denizen requires cloning the source repository locally.
Once Deno supports
[asset references](https://github.com/tc39/proposal-asset-references)
or something analogous, you will be able to run Denizen with a single command
(and hopefully, one day, no commands).

Use Git to clone the repository:

  ~~~~ sh
  git clone https://codeberg.org/dz4k/denizen && cd denizen
  ~~~~

Use `deployctl` to deploy it to your account:

  ~~~~ sh
  deno run -A jsr:@deno/deployctl deploy bin/denizen.ts --prod
  ~~~~

</details>


##      Setup

Opening your Denizen site (e.g. `clean-fox-95.deno.dev` or `http://localhost:8000`)
will show the initial setup interface.
Fill out your name (or the name of your site), the site URL if you own a domain
(e.g. `https://my-cool-site.example`), and set a password for the admin interface.
After you click <kbd>Get started</kbd>, you will be redirected to your site's homepage.


##      Login

If you are logged out of the admin account, go to
`http://<your Denizen site>/.denizen/login`
to log in.


##      Create your first post

Click <kbd>+ New Post</kbd> at the bottom of the home page
to create your first post.
(This button will only show up if you are logged in).
The post title and tags ar optional. You can add more fields
(e.g. a summary or photo) using the buttons below.
Click <kbd>Post</kbd> to post.


##    Customize your profile

Click <kbd>Console</kbd> at the bottom of the home page
to go to the site settings.
(This button will only show up if you are logged in).
You can edit your profile and bio and add social links.
You can also change your site URL (e.g. if you just bought a domain name).
