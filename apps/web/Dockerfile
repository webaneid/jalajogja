# ──────────────────────────────────────────────────────────────────────────────
# Stage 1: deps — install semua dependencies (termasuk playwright chromium)
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS deps

# Install Chromium system deps (dibutuhkan playwright untuk PDF generation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

# Install bun
RUN npm install -g bun@latest

WORKDIR /app

# Copy workspace manifests
COPY package.json bun.lock ./
COPY apps/web/package.json ./apps/web/
COPY packages/db/package.json ./packages/db/
COPY packages/ui/package.json ./packages/ui/
COPY packages/types/package.json ./packages/types/

# Install dependencies
RUN bun install --frozen-lockfile

# ──────────────────────────────────────────────────────────────────────────────
# Stage 2: builder — build Next.js app
# ──────────────────────────────────────────────────────────────────────────────
FROM deps AS builder

WORKDIR /app

# Copy source
COPY . .

# Skip playwright browser download (pakai chromium system)
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium

# Build
RUN bun run build --filter=@jalajogja/web

# ──────────────────────────────────────────────────────────────────────────────
# Stage 3: runner — image produksi minimal
# ──────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS runner

# Install Chromium system deps (dibutuhkan untuk PDF saat runtime)
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-noto \
    fonts-noto-cjk \
    libnss3 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
ENV NEXT_TELEMETRY_DISABLED=1

# Buat user non-root
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy hasil build standalone
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

# server.js adalah entrypoint dari Next.js standalone output
CMD ["node", "apps/web/server.js"]
