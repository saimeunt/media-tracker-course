# Development image shared by the api and web services (see compose.yaml).
# Dependencies are installed inside the image so native packages match Linux;
# source folders are bind-mounted by compose for live reload.
FROM node:24-slim

RUN npm install --global pnpm@12.3.4

WORKDIR /repo

# Manifests first, so the install layer is only rebuilt when dependencies change.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
COPY packages/seed-data/package.json packages/seed-data/
# Only what the containers run (api, web and the packages they use): not the slides, nor the
# root tools (the Bruno CLI), which are used on the host.
RUN pnpm install --frozen-lockfile --filter "@media-tracker/api..." --filter "@media-tracker/web..."
# pnpm checks dependencies before running a script and would install the filtered-out ones.
ENV pnpm_config_verify_deps_before_run=false

COPY . .
