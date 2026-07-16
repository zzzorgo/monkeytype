# syntax=docker/dockerfile:1.7
FROM node:24.11.0-alpine3.22 AS builder

WORKDIR /app

# Install pnpm once; keep its package store between Docker builds.
RUN npm i -g pnpm@10.28.1

# Copy only dependency manifests before installing. Source changes then reuse this
# layer, while the cache mount also avoids re-downloading packages after a cache miss.
COPY ["package.json", "pnpm-lock.yaml", "pnpm-workspace.yaml", "turbo.json", "./"]
COPY ["backend/package.json", "backend/package.json"]
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
COPY backend backend

RUN npm run build

#deploy (install all non-dev dependencies in a single node_module folder)
RUN pnpm deploy --legacy --filter backend --prod /prod/backend

#---------------------------------

## target image
FROM node:24.11.0-alpine3.22

## get server_version from build-arg, default to UNKNOWN
ARG server_version=UNKNOWN

# COPY to target
COPY --from=builder /prod/backend/node_modules /app/backend/node_modules
COPY --from=builder /prod/backend/dist /app/backend/dist
COPY --from=builder /prod/backend/email-templates /app/backend/email-templates
COPY --from=builder /prod/backend/redis-scripts /app/backend/redis-scripts
COPY --from=builder /prod/backend/private /app/backend/private

## to build directory
WORKDIR /app/backend/dist

## logs 
RUN mkdir -p /app/backend/dist/logs

COPY ["docker/backend/entry-point.sh", "./"]

RUN echo "${server_version}" > /app/backend/dist/server.version

#run in prod mode, but don't require anti-cheat, email client or firebase
ENV MODE=prod
ENV BYPASS_ANTICHEAT=true
ENV BYPASS_EMAILCLIENT=true
ENV BYPASS_FIREBASE=true

EXPOSE 5005
USER node

CMD [ "/bin/sh", "./entry-point.sh" ]
