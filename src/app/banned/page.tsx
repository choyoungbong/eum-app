// src/app/banned/page.tsx
// middleware.ts에서 isBanned 사용자를 이 페이지로 리디렉션

import { signOut } from "next-auth/react";
import Link from "next/link";

export default function BannedPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="w-20 h-20 rounded-2xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center mx-auto text-4xl">
          🚫
        </div>
        <div>
          <h1 className="text-2xl font-black text-gray-900 dark:text-slate-100 mb-2">
            계정이 정지되었습니다
          </h1>
          <p className="text-gray-500 dark:text-slate-400 text-sm">
            이 계정은 서비스 이용 규정 위반으로 인해 정지되었습니다.
            <br />
            문의사항은 관리자에게 연락해 주세요.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <a
            href="mailto:admin@eum.app"
            className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition text-center"
          >
            관리자에게 문의
          </a>
          <Link
            href="/api/auth/signout"
            className="w-full py-3 text-sm font-semibold text-gray-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-700 rounded-xl transition text-center"
          >
            로그아웃
          </Link>
        </div>
      </div>
    </div>
  );
}
