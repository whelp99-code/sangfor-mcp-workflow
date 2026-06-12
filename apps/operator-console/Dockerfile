FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/*/package.json packages/*/
COPY apps/operator-console/package.json apps/operator-console/

RUN pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build --filter=operator-console

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3500

COPY --from=builder /app/apps/operator-console/dist ./apps/operator-console/dist
COPY --from=builder /app/apps/operator-console/package.json ./apps/operator-console/
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages

EXPOSE 3500

CMD ["node", "apps/operator-console/dist/server.js"]
