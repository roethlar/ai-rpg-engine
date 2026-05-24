FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Install build dependencies for sqlite3 (since it compiles binary bindings)
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

# Install dependencies omitting dev dependencies
RUN npm install --omit=dev

# Copy source code and ensure it's owned by the node user
COPY --chown=node:node . .

# Set up data directory and ensure ownership
RUN mkdir -p data && chown -R node:node data

# Expose game server and MCP server ports
EXPOSE 3000

# Set environment variables defaults
ENV PORT=3000
ENV NODE_ENV=production

# Switch to the rootless node user
USER node

# Run start script
CMD [ "npm", "start" ]
