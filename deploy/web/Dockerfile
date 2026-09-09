# =============================================================================
# SHINE frontend container — builds the Vite SPA and serves it with nginx.
#
# This is the missing `web` service from docker-compose.yml. Caddy on the host
# reverse-proxies app.shine.dejoiy.com (and meet.dejoiy.com) to 127.0.0.1:8090,
# which is this container's published port — the "502 Bad Gateway" was caused
# by this container never existing.
#
# Build:  VITE_CONVEX_URL=<https://your-deployment>.convex.cloud is REQUIRED
#         (it's the Convex backend every query/mutation talks to).
# =============================================================================
FROM node:22-alpine AS builder
WORKDIR /app

# Convex deployment URL, baked into the static bundle at build time.
ARG VITE_CONVEX_URL
ENV VITE_CONVEX_URL=$VITE_CONVEX_URL

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY deploy/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# 80  = the published app port (Caddy -> 127.0.0.1:8090)
# 3000 = legacy compose upstream used by deploy/nginx/shine.conf (web:3000)
# 5173 = legacy compose upstream used by server/nginx.conf (web:5173)
EXPOSE 80 3000 5173
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1/ >/dev/null 2>&1 || exit 1