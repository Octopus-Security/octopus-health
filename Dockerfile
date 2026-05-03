FROM node:20-bookworm-slim

# Set working directory
WORKDIR /usr/src/app

# Copy package files first to maximize Docker layer cache hits
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev --no-audit --no-fund

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
