FROM node:20-slim

# Install ffmpeg, python3, pip, yt-dlp (pip), bgutil plugin
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg python3 python3-pip curl ca-certificates git \
    && pip3 install --break-system-packages yt-dlp bgutil-ytdlp-pot-provider \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# bgutil POT HTTP server (Node.js)
RUN git clone --depth 1 https://github.com/Brainicism/bgutil-ytdlp-pot-provider.git /opt/bgutil \
    && cd /opt/bgutil/server && npm ci && npx tsc \
    && rm -rf /opt/bgutil/.git

WORKDIR /app

# Install dependencies (all, including devDependencies for build)
COPY package.json package-lock.json* ./
RUN npm install

# Copy app
COPY . .

# Build Next.js
RUN npm run build

# Remove devDependencies after build
RUN npm prune --production 2>/dev/null || true

# Create storage directory
RUN mkdir -p /tmp/yt2c-storage/overlays /tmp/yt2c-storage/outputs /tmp/yt2c-storage/temp /tmp/yt2c-storage/frames

EXPOSE 3000

# Start POT server, worker, and Next.js
CMD ["sh", "-c", "node /opt/bgutil/server/build/main.js --port 4416 & node worker.js & npm start"]
