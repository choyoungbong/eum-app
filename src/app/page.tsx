"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";

export default function HomePage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.push("/dashboard");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-600">로딩 중...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* 헤더 */}
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-900 mb-4">
            ☁️
          </h1>
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Personal Cloud
          </h2>
          <p className="text-xl text-gray-600">
            나만의 클라우드 스토리지 & 미디어 서버
          </p>
        </div>

        {/* 기능 소개 */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">📁</div>
            <h3 className="text-lg font-semibold mb-2">파일 저장소</h3>
            <p className="text-gray-600 text-sm">
              안전하게 파일을 저장하고 관리하세요
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">🎥</div>
            <h3 className="text-lg font-semibold mb-2">미디어 스트리밍</h3>
            <p className="text-gray-600 text-sm">
              동영상을 어디서나 스트리밍으로 시청
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">👥</div>
            <h3 className="text-lg font-semibold mb-2">그룹 공유</h3>
            <p className="text-gray-600 text-sm">
              가족, 친구와 안전하게 파일 공유
            </p>
          </div>
        </div>

        {/* 시작하기 버튼 */}
        <div className="text-center space-y-4">
          <div className="space-x-4">
            <Link
              href="/signup"
              className="inline-block px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              회원가입
            </Link>
            <Link
              href="/login"
              className="inline-block px-8 py-3 bg-white text-blue-600 font-medium rounded-lg border-2 border-blue-600 hover:bg-blue-50 transition"
            >
              로그인
            </Link>
          </div>

          {/* 시스템 상태 */}
          <div className="mt-12 p-6 bg-white rounded-lg shadow-md">
            <h3 className="text-lg font-semibold mb-4">✅ 시스템 상태</h3>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-green-600">●</span> Next.js 14
              </div>
              <div>
                <span className="text-green-600">●</span> PostgreSQL 연결
              </div>
              <div>
                <span className="text-green-600">●</span> 인증 시스템
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}