# Based on https://github.com/denoland/deno_docker/blob/main/alpine.dockerfile

ARG DENO_VERSION=2.1.5
ARG BUILD_IMAGE=denoland/deno:alpine-${DENO_VERSION}

FROM ${BUILD_IMAGE} AS build
RUN mkdir -p /usr/local/src/denizen
WORKDIR /usr/local/src/denizen
COPY . .
RUN deno compile \
  --include lib/public/ --include lib/views/ \
  --unstable-kv -A --no-check \
  -o /usr/local/bin/denizen \
  bin/denizen.ts

FROM frolvlad/alpine-glibc:alpine-3.18
RUN apk --no-cache add ca-certificates
RUN addgroup --gid 1000 deno \
  && adduser --uid 1000 --disabled-password deno --ingroup deno
COPY --from=build /usr/local/bin/denizen /usr/bin/denizen
ENV DENIZEN_KV=/var/denizen/kv.sqlite
ENV DENIZEN_BLOBS=/var/denizen/blobs
ENTRYPOINT ["denizen"]
