FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate
WORKDIR /app
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* tsconfig.base.json eslint.config.js .prettierrc ./
COPY packages ./packages
COPY apps ./apps
RUN pnpm install --frozen-lockfile=false
RUN pnpm --filter @sms/shared build && pnpm --filter @sms/web build && pnpm --filter @sms/server build
RUN pnpm --filter @sms/shared test && pnpm --filter @sms/server test

FROM node:20-bookworm-slim
WORKDIR /app
COPY --from=build /app /app
ENV NODE_ENV=production
ENV SMS_DATA_DIR=/data
ENV SMS_HOST=0.0.0.0
ENV SMS_PORT=3847
VOLUME ["/data"]
EXPOSE 3847
CMD ["node", "apps/server/dist/index.js"]
