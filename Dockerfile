# --- Build stage ---------------------------------------------------------
FROM node:22-bookworm-slim AS build

WORKDIR /app

# better-sqlite3 ships prebuilds, but keep the toolchain so a from-source
# build still works on other architectures.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends python3 make g++ \
	&& rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build && npm prune --omit=dev

# --- Runtime stage -------------------------------------------------------
FROM node:22-bookworm-slim AS runtime

WORKDIR /app

ENV NODE_ENV=production \
	PORT=3000 \
	DATABASE_PATH=/data/daybook.db

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/build ./build
COPY --from=build /app/package.json ./package.json
COPY server.js ./server.js
COPY scripts ./scripts

RUN mkdir -p /data
# Runs as root inside the container, matching the other Unraid containers
# (e.g. StreamAssets), so the mounted data path does not need a host chown.

EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/login').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
