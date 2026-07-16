# syntax=docker/dockerfile:1.7
FROM node:24.11.0-alpine3.22 AS builder
WORKDIR /app

#ENV
ENV BACKEND_URL=###MONKEYTYPE_BACKENDURL### RECAPTCHA_SITE_KEY=###RECAPTCHA_SITE_KEY###

# Install pnpm once; keep its package store between Docker builds.
RUN npm i -g pnpm@10.28.1

# Copy only dependency manifests before installing. Source changes then reuse this
# layer, while the cache mount also avoids re-downloading packages after a cache miss.
COPY ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", "./"]
COPY ["frontend/package.json", "frontend/package.json"]
COPY ["frontend/storybook/package.json", "frontend/storybook/package.json"]
COPY ["packages/challenges/package.json", "packages/challenges/package.json"]
COPY ["packages/contracts/package.json", "packages/contracts/package.json"]
COPY ["packages/funbox/package.json", "packages/funbox/package.json"]
COPY ["packages/oxlint-config/package.json", "packages/oxlint-config/package.json"]
COPY ["packages/release/package.json", "packages/release/package.json"]
COPY ["packages/schemas/package.json", "packages/schemas/package.json"]
COPY ["packages/tsup-config/package.json", "packages/tsup-config/package.json"]
COPY ["packages/typescript-config/package.json", "packages/typescript-config/package.json"]
COPY ["packages/util/package.json", "packages/util/package.json"]

RUN --mount=type=cache,id=monkeytype-pnpm-store,target=/pnpm/store,sharing=locked \
    pnpm config set store-dir /pnpm/store && \
    pnpm i --frozen-lockfile

COPY packages packages
COPY frontend frontend

COPY docker/frontend/firebase-config-live.ts frontend/src/ts/constants/firebase-config.ts
COPY docker/frontend/firebase-config-live.ts frontend/src/ts/constants/firebase-config-live.ts

RUN npm run build

# COPY to target
FROM nginx:mainline-alpine

COPY --from=builder /app/frontend/dist /usr/share/nginx/html
COPY docker/frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/frontend/updateConfig.sh /docker-entrypoint.d/updateConfig.sh
RUN chmod +x /docker-entrypoint.d/updateConfig.sh

# entry
#CMD ["./entryPoint.sh"]
