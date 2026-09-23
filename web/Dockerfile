# Algebra web app — production image (Next.js standalone output).
#   docker build -t algebra-web --build-arg ALGEBRA_API_URL=https://api.internal:8080 web
#   docker run --env-file web/.env.production -p 3000:3000 algebra-web
#
# ALGEBRA_API_URL is needed at BUILD time too: Next bakes the /api/v1
# rewrite destination into the build. LLM keys (GEMINI_API_KEY, ...) are
# runtime-only — never pass them as build args.

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG ALGEBRA_API_URL=http://api:8080
ENV ALGEBRA_API_URL=$ALGEBRA_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && pnpm build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0
RUN addgroup -S app && adduser -S app -G app
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
EXPOSE 3000
CMD ["node", "server.js"]
