# Stage 1: build the standalone server. It runs per target platform (no
# --platform=$BUILDPLATFORM) because the traced output includes native
# binaries such as sharp. API_URL and GOOGLE_CLIENT_ID are inlined at build
# time; an empty API_URL (unset CI secret) falls back to production. Base images
# are pinned by digest so Dependabot can update them (Spec 010, RF-38).
FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797 AS build
RUN npm install -g pnpm@12.6.0
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG API_URL=https://api.figueroa-sanchez.com
ARG GOOGLE_CLIENT_ID=
ENV NEXT_TELEMETRY_DISABLED=1 API_URL=$API_URL GOOGLE_CLIENT_ID=$GOOGLE_CLIENT_ID
RUN pnpm build

# Stage 2: unprivileged runtime with only the traced files.
FROM node:26-alpine@sha256:40cd011b55415bc894e45b02fdd5a5dfde056921b7d23a64c74f80497af48797
# Alpine fixes published after the base image, and no npm/npx: the server only runs `node`,
# and the bundled npm only adds packages to scan and patch (Spec 010, RF-39, RF-40, plan D11).
# No BusyBox and no shell either (Spec 011, D1, D2, D8): alpine-baselayout is removed with it,
# keeping alpine-baselayout-data (/etc/passwd, /etc/hosts). apk del goes last because every RUN
# and `rm` need the shell it removes; nothing after this line may need one.
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx \
      /usr/local/bin/docker-entrypoint.sh \
 && apk add --no-cache alpine-baselayout-data \
 && apk del --no-cache alpine-baselayout busybox busybox-binsh ssl_client
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=root:root /app/.next/standalone ./
COPY --from=build --chown=root:root /app/.next/static ./.next/static
COPY --from=build --chown=root:root /app/public ./public
USER node
EXPOSE 3000
# Exec form, without wget or a shell: healthy only on a 2xx from /login (Spec 011, D4, D5).
HEALTHCHECK --interval=30s --timeout=3s CMD ["node", "-e", "fetch('http://127.0.0.1:3000/login').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
# The base image's docker-entrypoint.sh is a shell script (Spec 011, D3).
ENTRYPOINT []
CMD ["node", "server.js"]
