/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      [path.resolve(__dirname, 'src/app/api/auth/[...nextauth]/route')]:
        path.resolve(__dirname, 'src/lib/auth'),
    };
    return config;
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      {
        protocol: 'https',
        hostname: '**.up.railway.app',
      },
      {
        protocol: 'https',
        hostname: '**.mooo.com',
      },
    ],
  },
  swcMinify: true,
  compress: true,
}
module.exports = nextConfig
