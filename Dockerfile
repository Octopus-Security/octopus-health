FROM node:22-alpine

# Patch Alpine OS packages before anything else
RUN apk upgrade --no-cache

# Set working directory
WORKDIR /usr/src/app

# sqlite3 requires native compilation on alpine
RUN apk add --no-cache python3 make g++

# Copy package files first to maximize Docker layer cache hits
COPY package*.json ./

# Install production dependencies (builds sqlite3 from source)
RUN npm install --omit=dev --no-audit --no-fund

# Copy application code
COPY --chown=node:node . .

# Ensure runtime data dir exists and is writable
RUN mkdir -p /usr/src/app/data && chown -R node:node /usr/src/app/data

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Start app
CMD ["node", "index.js"]
