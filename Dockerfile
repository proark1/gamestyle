FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build:railway

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PATH=/data/stack-or-sink.sqlite
COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/db/sqlite.mjs ./db/sqlite.mjs
COPY --from=build /app/db/node.ts /app/db/contract.ts ./db/
COPY --from=build /app/shared/challenges ./shared/challenges
COPY --from=build /app/shared/accounts/server/crypto.ts ./shared/accounts/server/crypto.ts
COPY --from=build /app/shared/rooms/identity.ts ./shared/rooms/identity.ts
COPY --from=build /app/scripts/migrate.mjs ./scripts/migrate.mjs
COPY --from=build /app/scripts/start-production.mjs ./scripts/start-production.mjs
COPY --from=build /app/scripts/finalize-ranked.ts /app/scripts/review-ranked-run.ts ./scripts/
EXPOSE 3000
CMD ["node", "scripts/start-production.mjs"]
