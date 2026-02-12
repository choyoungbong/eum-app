/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },

  images: {
    remotePatterns: [
      // 로컬 개발
      {
        protocol: 'http',
        hostname: 'localhost',
      },
      // Railway 배포
      {
        protocol: 'https',
        hostname: '**.up.railway.app',
      },
      // 커스텀 도메인 (FreeDNS 등)
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