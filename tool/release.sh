#!/usr/bin/env bash
set -Eeuo pipefail

die() { echo "$@" >&2; exit 1; }

test ! -z "${RELEASE:-}" || die "RELEASE env. var. is undefined"
command -v fj >/dev/null || die "forgejo-cli (fj) not installed"
RELEASE=${RELEASE#v}

# Compile
sh tool/compile.sh

# Create commit
jj new -m "v$RELEASE"
jj bookmark move main --to @

# Create release
fj release --repo codeberg.org/dz4k/denizen create \
  --create-tag "v$RELEASE" \
  --draft \
  $([[ "$RELEASE" =~ "-devel" ]] && echo --prerelease) \
  $(find build -name 'denizen-*' -exec echo --attach {} \;) \
  "Release v$RELEASE"

# Build container
podman build . -t denizen:$RELEASE
podman push denizen:$RELEASE codeberg.org/dz4k/denizen:$RELEASE
podman push denizen:$RELEASE codeberg.org/dz4k/denizen:latest
