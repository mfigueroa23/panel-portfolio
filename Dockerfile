# Stage 1: build the standalone server. It runs per target platform (no
# --platform=$BUILDPLATFORM) because the traced output includes native
# binaries such as sharp. API_URL and GOOGLE_CLIENT_ID are inlined at build
# time; an empty API_URL (unset CI secret) falls back to production.
FROM node:26-alpine AS build
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
FROM node:26-alpine
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build --chown=root:root /app/.next/standalone ./
COPY --from=build --chown=root:root /app/.next/static ./.next/static
COPY --from=build --chown=root:root /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -q -O /dev/null http://127.0.0.1:3000/login || exit 1
CMD ["node", "server.js"]
