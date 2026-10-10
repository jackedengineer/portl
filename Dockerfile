FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
RUN npm install --global pnpm@11.19.0
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/domain/package.json packages/domain/package.json
COPY packages/database/package.json packages/database/package.json

FROM dependencies AS build
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build:api

FROM dependencies AS production-dependencies
RUN pnpm install --frozen-lockfile --prod --filter @portl/api...

FROM node:24-bookworm-slim AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies --chown=node:node /app /app
COPY --from=build --chown=node:node /app/apps/api/dist /app/apps/api/dist
COPY --chown=node:node packages/database/migrations /app/apps/api/migrations
WORKDIR /app/apps/api
USER node
EXPOSE 4000
CMD ["node", "dist/server.js"]
