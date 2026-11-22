FROM node:24.22.3-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/contracts/package.json packages/contracts/package.json
COPY services/catalogue-api/package.json services/catalogue-api/package.json
COPY services/catalogue-web/package.json services/catalogue-web/package.json
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY services/catalogue-web services/catalogue-web
RUN npm run build --workspace @linden-shelf/contracts && npm --prefix services/catalogue-web run build

FROM nginxinc/nginx-unprivileged:1.31.7-alpine AS runtime
COPY --from=build --chown=101:101 /app/services/catalogue-web/dist /usr/share/nginx/html
COPY --chown=101:101 services/catalogue-web/nginx.conf /etc/nginx/conf.d/default.conf
USER 101:101
EXPOSE 8080
HEALTHCHECK --interval=10s --timeout=3s --start-period=5s --retries=5 CMD ["wget", "-q", "-O", "/dev/null", "http://127.0.0.1:8080/healthz"]
STOPSIGNAL SIGQUIT
CMD ["nginx", "-g", "daemon off;"]