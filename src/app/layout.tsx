import type { Metadata } from "next";
import { Providers } from "./providers";
import { ToastContainer } from "@/components/Toast";
import "./globals.css";

export const metadata: Metadata = {
  title: "이음 (Eum)",
  description: "사람과 파일을 잇다",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
        {/* ✅ 전역 Toast — 모든 페이지에서 toast.error() 등 사용 가능 */}
        <ToastContainer />
      </body>
    </html>
  );
}
