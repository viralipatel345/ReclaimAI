# Reclaim — production image for Cloud Run.
# Secrets (GEMINI_API_KEY, RECHECK_CRON_SECRET) are NOT baked in: pass them at runtime
# (Cloud Run env vars / Secret Manager). .dockerignore keeps every .env* file out.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:24-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=8080 \
    HOSTNAME=0.0.0.0
RUN addgroup -S reclaim && adduser -S reclaim -G reclaim
COPY --from=build --chown=reclaim:reclaim /app/.next/standalone ./
COPY --from=build --chown=reclaim:reclaim /app/.next/static ./.next/static
COPY --from=build --chown=reclaim:reclaim /app/public ./public
USER reclaim
EXPOSE 8080
CMD ["node", "server.js"]
