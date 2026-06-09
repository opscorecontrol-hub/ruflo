# ── Stage 1: Builder ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ── Stage 2: Production ───────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/serve_dist.js ./serve_dist.js
COPY --from=builder /app/package.json ./package.json

EXPOSE 4000

ENV PORT=4000

CMD ["node", "serve_dist.js"]
