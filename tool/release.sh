#!/usr/bin/env bash
set -Eeuo pipefail

die() { echo "$@" >&2; exit 1; }

test ! -z "${RELEASE:-}" || die "RELEASE env. var. is undefined"
command -v fj >/dev/null || die "forgejo-cli (fj) not installed"
RELEASE=${RELEASE#v}

# Compile
rm -rf build/
sh tool/compile.sh

# Create commit
jj new -m "v$RELEASE"
jj bookmark move main --to @
jj new

# Create release
fj release --repo codeberg.org/dz4k/denizen create \
  --create-tag "v$RELEASE" \
  --draft \
  $(case $RELEASE in *-devel.*) echo --prerelease; esac) \
  $(find build -name 'denizen-*' | xargs -n1 echo --attach) \
  "Release v$RELEASE"

# Build container
cat <<end | xargs -L1 podman
  build . -t "denizen:$RELEASE"
  push "denizen:$RELEASE" "codeberg.org/dz4k/denizen:$RELEASE"
  push "denizen:$RELEASE" "codeberg.org/dz4k/denizen:latest"
end
