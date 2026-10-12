# Один образ для API (server) и фоновых воркеров (workers) + сборка клиента.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY workers/package.json workers/
COPY client/package.json client/
COPY scripts/package.json scripts/
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build -w server && npm run build -w workers && npm run build -w client \
 && npm prune --omit=dev --no-audit --no-fund

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/migrations ./server/migrations
COPY --from=build /app/server/assets ./server/assets
COPY --from=build /app/workers/package.json ./workers/
COPY --from=build /app/workers/dist ./workers/dist
COPY --from=build /app/client/dist ./client/dist
USER node
WORKDIR /app/server
EXPOSE 8040
CMD ["node", "dist/index.js"]
