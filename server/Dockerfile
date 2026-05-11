# BTM API — Hono + Better-Auth + Drizzle, gebaut als schlankes Production-Image.
# Multi-Stage: build-stage compiliert TypeScript, runtime-stage hat nur Production-deps.

FROM node:22-alpine AS build
WORKDIR /app

# Erst nur package*.json kopieren — Layer-Cache für npm ci nutzen
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Source kopieren + bauen
COPY tsconfig.json ./
COPY drizzle ./drizzle
COPY drizzle.config.ts ./
COPY src ./src
COPY assets ./assets
RUN npm run build

# Production-Deps separat installieren (kleineres Image)
RUN npm prune --omit=dev


FROM node:22-alpine AS runtime
WORKDIR /app

# tini als PID-1 für sauberes Signal-Handling
RUN apk add --no-cache tini

ENV NODE_ENV=production \
    PORT=3001 \
    HOST=0.0.0.0

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/assets ./assets
COPY package.json ./

EXPOSE 3001

# Healthcheck — Caddy / docker-compose nutzen das
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/healthz || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
