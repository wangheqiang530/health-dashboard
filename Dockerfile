FROM node:22-alpine AS base
RUN npm install -g pnpm@11.25.0
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dependencies AS build
COPY . .
RUN pnpm build

FROM node:22-alpine AS runtime
ARG APP_VERSION=0.0.9
LABEL org.opencontainers.image.title="health-dashboard" \
      org.opencontainers.image.version="${APP_VERSION}" \
      org.opencontainers.image.source="https://github.com/wangheqiang530/health-dashboard"
RUN apk add --no-cache postgresql-client
RUN npm install -g pnpm@11.25.0
WORKDIR /app
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080
ENV DATA_DIR=/app/data

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/src ./src

RUN mkdir -p /app/data
EXPOSE 8080
CMD ["pnpm", "start"]
