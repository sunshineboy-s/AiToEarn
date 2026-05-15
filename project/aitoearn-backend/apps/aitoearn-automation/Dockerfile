# aitoearn-automation
#
# Built on top of the official Playwright image (Ubuntu 24.04 + Chromium +
# system fonts/codecs) so we don't reinstall the headless browser at runtime.
# The image is large (~1.5 GB) — for production we'll switch to playwright:slim
# and ship only Chromium.

FROM node:24-bookworm-slim AS deps

RUN npm install -g pnpm

WORKDIR /app

COPY deps/ ./

RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod

# ---

FROM mcr.microsoft.com/playwright:v1.49.0-jammy AS production

ARG APP_NAME=aitoearn-automation

WORKDIR /app

COPY assets/ ./
COPY --from=deps /app/ ./

COPY apps/ ./apps/
COPY libs/ ./libs/

ENV NODE_ENV=production
ENV APP_NAME=$APP_NAME
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# pwuser is provided by the Playwright base image and already has the
# right permissions on /ms-playwright.
USER pwuser

CMD ["sh", "-c", "node apps/${APP_NAME}/src/main.js -c config.js"]
