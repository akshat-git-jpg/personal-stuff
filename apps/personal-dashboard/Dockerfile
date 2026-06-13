FROM node:22-slim

# Build tools required for better-sqlite3 native compilation.
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install production deps.
COPY package.json package-lock.json* .npmrc* ./
RUN npm install --omit=dev --no-audit --no-fund

# Copy source.
COPY src/ ./src/
COPY public/ ./public/

ENV NODE_ENV=production

# SQLite DB is stored on a bind-mounted volume at /app/data.
# Do NOT copy data/ — it is mounted at runtime.
VOLUME ["/app/data"]

EXPOSE 8787

CMD ["node", "src/server.js"]
