/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/easy', destination: '/' },
      { source: '/free', destination: '/' },
      { source: '/share', destination: '/' },
    ];
  },
  // API route body size limit (overlay PNG can be large)
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
  // Exclude bullmq/ioredis from client bundle and prevent build-time errors
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        net: false,
        tls: false,
        fs: false,
        child_process: false,
      };
    }
    return config;
  },
};

module.exports = nextConfig;
