# --- Build stage ------------------------------------------------------------
# Multi-stage so the final image is just nginx + dist (no node, no node_modules).
FROM node:20-alpine AS builder

WORKDIR /app

# Cache layer: copy manifests first so dep install is reused unless deps change.
COPY package.json yarn.lock* bun.lock* ./
RUN if [ -f yarn.lock ]; then \
        corepack enable && yarn install --frozen-lockfile; \
    elif [ -f bun.lock ]; then \
        npm install -g bun && bun install --frozen-lockfile; \
    else \
        npm ci; \
    fi

COPY . .

# VITE_* env are baked into the bundle at build time. Pass them via build-arg.
ARG VITE_API_HOST=""
ARG VITE_SENTRY_DSN=""
ARG VITE_SENTRY_TRACES_RATE="0.1"
ARG VITE_SENTRY_REPLAY_RATE="0"
ARG VITE_SENTRY_PII="false"
ENV VITE_API_HOST=$VITE_API_HOST \
    VITE_SENTRY_DSN=$VITE_SENTRY_DSN \
    VITE_SENTRY_TRACES_RATE=$VITE_SENTRY_TRACES_RATE \
    VITE_SENTRY_REPLAY_RATE=$VITE_SENTRY_REPLAY_RATE \
    VITE_SENTRY_PII=$VITE_SENTRY_PII

RUN if [ -f yarn.lock ]; then yarn build; \
    elif [ -f bun.lock ]; then bun run build; \
    else npm run build; fi


# --- Runtime stage ----------------------------------------------------------
FROM nginx:1.27-alpine

# Strip the default site so our config is the only one nginx loads.
RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/admin-panel.conf
COPY --from=builder /app/dist /usr/share/nginx/html

# nginx runs as `nginx` user by default; the alpine image already drops
# privileges from the worker processes. Master needs root to bind :80.
EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://127.0.0.1/ || exit 1

CMD ["nginx", "-g", "daemon off;"]
