# Образ веб-приложения: сборка Vite и nginx с переадресацией /api на API.
FROM docker.io/library/node:24.21.0-alpine3.24 AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN npm ci -w web --no-audit --no-fund
COPY web web
RUN npm run build -w web

FROM docker.io/library/nginx:1.31.5-alpine3.24
COPY web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /src/web/dist /usr/share/nginx/html
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
