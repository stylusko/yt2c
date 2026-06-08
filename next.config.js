/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      { source: '/easy', destination: '/' },
      { source: '/edit', destination: '/' },
      { source: '/ai-edit', destination: '/' },
      { source: '/share', destination: '/' },
      { source: '/bmonly', destination: '/' },
      { source: '/bmonly/easy', destination: '/' },
      { source: '/bmonly/ai-edit', destination: '/' },
      { source: '/bmonly/article', destination: '/' },
      { source: '/bmonly/edit', destination: '/' },
      { source: '/s/:id/bmonly', destination: '/' },
      { source: '/s/:id', destination: '/' },
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
