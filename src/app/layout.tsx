import type { Metadata } from "next";
import { Providers } from "./providers";
import PWAInstaller from "@/components/PWAInstaller";
import "./globals.css";

export const metadata: Metadata = {
  title: "이음 (Eum)",
  description: "사람과 파일을 잇다 - 나만의 퍼스널 클라우드",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "이음",
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body suppressHydrationWarning>
        <Providers>
          {children}
          <PWAInstaller />
        </Providers>
      </body>
    </html>
  );
}
