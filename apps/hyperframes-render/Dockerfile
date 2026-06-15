# Node 22 (Hyperframes needs >=22) + ffmpeg + Chrome for headless rendering.
FROM node:22-bookworm

# ffmpeg/ffprobe for encoding, plus the shared libs chrome-headless-shell needs.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates fonts-liberation \
    libnss3 libnspr4 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libdbus-1-3 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 \
    libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    libwayland-client0 libx11-6 libxcb1 libxext6 libxi6 libgtk-3-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Pin Hyperframes and pre-download Chrome at build time so the first user
# render isn't a 100 MB download. Cached under /root/.cache/puppeteer.
ENV HF_VERSION=0.6.97
RUN npx --yes hyperframes@${HF_VERSION} browser ensure

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY src/ ./src/
COPY public/ ./public/

ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080

CMD ["node", "src/server.js"]
