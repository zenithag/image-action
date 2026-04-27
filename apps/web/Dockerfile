FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/contracts/package.json packages/contracts/
COPY packages/tenant-context/package.json packages/tenant-context/
RUN pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ARG NEXT_PUBLIC_WS_URL=http://localhost:8000
ARG NEXT_PUBLIC_ENABLE_WS=false
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_ENABLE_WS=$NEXT_PUBLIC_ENABLE_WS
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NODE_OPTIONS=--no-experimental-webstorage
COPY --from=deps /app/ ./
COPY apps/web/ apps/web/
COPY packages/contracts/ packages/contracts/
COPY packages/tenant-context/ packages/tenant-context/
WORKDIR /app/apps/web
RUN pnpm build

FROM base AS runner
WORKDIR /app
RUN apk add --no-cache fontconfig
ENV NODE_ENV=production
ENV NODE_OPTIONS=--no-experimental-webstorage
ENV VISUALFLOW_DATA_DIR=/app/apps/web/.local
ENV VISUALFLOW_PUBLIC_DIR=/app/apps/web/public
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/scripts ./apps/web/scripts
RUN mkdir -p /app/apps/web/.local /app/apps/web/public/generated
VOLUME ["/app/apps/web/.local", "/app/apps/web/public/generated"]

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
