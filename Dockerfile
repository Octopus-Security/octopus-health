FROM node:22-alpine

# Patch Alpine OS packages before anything else
RUN apk upgrade --no-cache

# Set working directory
WORKDIR /usr/src/app

# sqlite3 requires native compilation on alpine
RUN apk add --no-cache python3 make g++

# Copy package files first to maximize Docker layer cache hits
ARG NPM_TOKEN
COPY package*.json ./
RUN echo "@octopus-security:registry=https://npm.pkg.github.com" > .npmrc \
 && echo "//npm.pkg.github.com/:_authToken=${NPM_TOKEN}" >> .npmrc \
 && npm install --omit=dev --no-audit --no-fund --legacy-peer-deps \
 && rm -f .npmrc

# Copy application code
COPY --chown=node:node . .

# Ensure runtime data dir exists and is writable
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app/data

# Strip npm from the runtime image. Nothing here runs it — the CMD is a bare
# `node` — but Trivy reports what is PRESENT, not what is reachable, and npm
# bundles its own vulnerable tree: tar 7.5.11 (CVE-2026-59873, CRITICAL),
# pacote, sigstore, brace-expansion, picomatch, ip-address. Measured against
# node:22-alpine on 2026-09-21: 1 CRITICAL / 12 HIGH with npm, 0 / 2 without —
# 11 of those 13 findings were npm's, not Alpine's.
#
# Must run as root, so it goes above any USER line. octopus-cortex is the one
# service that keeps npm: its CVE checker shells out to `npm audit`.
# Guarded by octopus-vault/scripts/check-no-npm.mjs.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
           /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "index.js"]
