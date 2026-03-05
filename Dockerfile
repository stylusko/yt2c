FROM node:20-slim

# Install ffmpeg and yt-dlp
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    curl \
    ca-certificates \
    && curl -L https://github.com/yt-dlp/yt-dlp-nightly-builds/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

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
RUN mkdir -p /tmp/yt2c-storage/overlays /tmp/yt2c-storage/outputs /tmp/yt2c-storage/temp

EXPOSE 3000

# Start both Next.js server and worker
CMD ["sh", "-c", "node worker.js & npm start"]
