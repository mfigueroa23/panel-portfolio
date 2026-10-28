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
RUN apk upgrade --no-cache \
 && rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=root:root /app/.next/standalone ./
COPY --from=build --chown=root:root /app/.next/static ./.next/static
COPY --from=build --chown=root:root /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
