cat <<EOF | xargs -t -I% -P$(nproc) \
  deno compile \
    -o "denizen-$RELEASE-%" \
    --target=% \
    --include lib/public/ --include lib/views/ \
    --unstable-kv -A --no-check \
    bin/denizen.ts
x86_64-unknown-linux-gnu
aarch64-unknown-linux-gnu
x86_64-pc-windows-msvc
x86_64-apple-darwin
aarch64-apple-darwin
EOF
