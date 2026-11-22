FROM node:24.22.3-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY services/catalogue-api/package.json services/catalogue-api/package.json
COPY services/catalogue-web/package.json services/catalogue-web/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY services/catalogue-api services/catalogue-api
RUN npm run build --workspace @linden-shelf/contracts && npm run build --workspace @linden-shelf/catalogue-api

FROM node:24.22.3-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY services/catalogue-api/package.json services/catalogue-api/package.json
COPY services/catalogue-web/package.json services/catalogue-web/package.json
RUN npm ci --omit=dev --workspace @linden-shelf/contracts --workspace @linden-shelf/catalogue-api --include-workspace-root=false

FROM node:24.22.3-bookworm-slim AS runtime
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/packages/contracts/package.json ./packages/contracts/package.json
COPY --from=build --chown=node:node /app/packages/contracts/dist ./packages/contracts/dist
COPY --from=build --chown=node:node /app/services/catalogue-api/package.json ./services/catalogue-api/package.json
COPY --from=build --chown=node:node /app/services/catalogue-api/dist ./services/catalogue-api/dist
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=5 CMD ["node", "-e", "fetch('http://127.0.0.1:3001/api/health',{signal:AbortSignal.timeout(2000)}).then(response=>{if(!response.ok)process.exit(1)}).catch(()=>process.exit(1))"]
CMD ["node", "services/catalogue-api/dist/server.js"]