---
title: Install
---

You can test Denizen by running it on your own PC.
When you're ready to make a public website,
you can do the same on a server, such as a VPS purchased from a hosting company,
or use the service Deno Deploy.

<details open name="how-to-run">
<summary>Run on your own server or personal computer</summary>

You can run Denizen locally on your computer or on a server by downloading a binary release from
[Denizen's releases page on Codeberg](https://codeberg.org/dz4k/denizen/releases).

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
