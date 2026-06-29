# -----------------------
# Stage 1: Dependencies
# -----------------------
FROM node:22-alpine AS deps

WORKDIR /app
RUN npm install -g pnpm@9

COPY package.json pnpm-lock.yaml ./
ENV PNPM_CONFIG_DANGEROUSLY_ALLOW_ALL_BUILDS=true
RUN pnpm install --fetch-timeout 600000

# -----------------------
# Stage 2: Builder
# -----------------------
FROM node:22-alpine AS builder

WORKDIR /app
RUN npm install -g pnpm@9

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time env vars (required by config/env.js)
ARG CF_API_TOKEN
ARG CF_ACCOUNT_ID
ARG JWT_SECRET
ARG JWT_REFRESH_SECRET

ENV CF_API_TOKEN=${CF_API_TOKEN}
ENV CF_ACCOUNT_ID=${CF_ACCOUNT_ID}
ENV JWT_SECRET=${JWT_SECRET}
ENV JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN pnpm build

# -----------------------
# Stage 3: Runner
# -----------------------
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 2000

ENV PORT=2000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
