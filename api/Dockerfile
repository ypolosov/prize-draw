# Образ API. Контекст сборки - корень репозитория (рабочие пространства npm).
FROM docker.io/library/node:24.21.0-alpine3.24 AS build
WORKDIR /src
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN npm ci -w api --include-workspace-root --no-audit --no-fund
COPY api api
RUN npm run build -w api

FROM docker.io/library/node:24.21.0-alpine3.24
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY web/package.json web/
COPY e2e/package.json e2e/
RUN npm ci -w api --omit=dev --no-audit --no-fund && npm cache clean --force
COPY --from=build /src/api/dist api/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=5s --timeout=3s --retries=12 CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "api/dist/main.js"]
