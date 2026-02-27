// next.config.js (또는 next.config.mjs)
// Docker standalone 빌드 + 보안 헤더 설정

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 멀티스테이지 빌드용 — 최소 파일만 포함
  output: "standalone",

  // 이미지 최적화 도메인
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // 실험적 기능
  experimental: {
    serverComponentsExternalPackages: ["sharp", "winston", "socket.io"],
  },

  // ── 보안 헤더 (Nginx가 없는 환경 대비) ──────────────────
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options",        value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
      // 정적 파일 장기 캐시
      {
        source: "/_next/static/:path*",
        headers: [
          { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
        ],
      },
    ];
  },

  // ── 리디렉션 ─────────────────────────────────────────────
  async redirects() {
    return [
      {
        source:      "/home",
        destination: "/dashboard",
        permanent:   true,
      },
    ];
  },

  // BigInt JSON 직렬화 경고 억제
  webpack(config) {
    config.resolve.fallback = { fs: false, path: false };
    return config;
  },
};

module.exports = nextConfig;
