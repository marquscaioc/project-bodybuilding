# ─────────────────────────────────────────────────────────────────────
# Multi-stage build for the Next.js scorecard app.
# Stage 1 installs deps + builds; stage 2 ships only what's needed to
# run `next start`.
# ─────────────────────────────────────────────────────────────────────

# ─── 1. Builder ───
FROM node:20-alpine AS builder
WORKDIR /app

# Native modules from onnxruntime-node need libc6-compat on Alpine.
RUN apk add --no-cache libc6-compat

# Install deps first for better caching (separate from source copy).
COPY package.json package-lock.json* ./
RUN npm install --include=optional --no-audit --no-fund

# Copy source. .dockerignore keeps node_modules/.next/.env*.local out.
COPY . .

# NEXT_PUBLIC_* vars need to be present at build time (baked into the
# client bundle). Railway injects them via build env when configured.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

RUN npm run build

# ─── 2. Runtime ───
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN apk add --no-cache libc6-compat

# Copy only what `next start` needs: deps, build output, public assets,
# config, and the package manifests for the start script.
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./

# Railway sets $PORT at runtime; default to 3000 for local docker run.
ENV PORT=3000
EXPOSE 3000

CMD ["sh", "-c", "npx next start -p ${PORT:-3000}"]
