#!/usr/bin/env bash
set -Eeuo pipefail

die() { echo "$@" >&2; exit 1; }

test ! -z "${RELEASE:-}" || die "RELEASE env. var. is undefined"
command -v fj >/dev/null || die "forgejo-cli (fj) not installed"

# Compile
sh tool/compile.sh

# Create commit
jj new -m "$RELEASE"
jj bookmark move main --to @

# Create release
fj release --repo codeberg.org/dz4k/denizen create \
  --create-tag "$RELEASE" \
  --draft \
  $([[ "$RELEASE" =~ "-devel" ]] && echo --prerelease) \
  $(find build -name 'denizen-*' -exec echo --attach {} \;) \
  "Release $RELEASE"
