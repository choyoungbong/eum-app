"use client";

import React, { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react"; // 로딩 아이콘용

function LoginForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // searchParams가 null일 경우를 대비한 안전한 접근
  const isSignupSuccess = searchParams?.get("signup") === "success";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        router.push("/dashboard");
        router.refresh();
      } else {
        const data = await res.json();
        setError(data.message || "로그인에 실패했습니다.");
      }
    } catch (err) {
      setError("서버 연결에 실패했습니다.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-white dark:bg-zinc-900 border dark:border-zinc-800 rounded-xl shadow-sm overflow-hidden">
      <div className="p-6">
        <div className="space-y-1 mb-6">
          <h2 className="text-2xl font-bold tracking-tight dark:text-white">로그인</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400">계정에 접속하여 서비스를 이용하세요.</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {isSignupSuccess && (
            <div className="p-3 rounded-lg bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-900">
              <p className="text-sm text-green-600 dark:text-green-400">
                회원가입이 완료되었습니다. 로그인해 주세요.
              </p>
            </div>
          )}
          
          {error && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-900/20 dark:border-red-900">
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-200">이메일</label>
            <input 
              type="email" 
              placeholder="name@example.com" 
              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium dark:text-zinc-200">비밀번호</label>
            <input 
              type="password" 
              className="w-full px-3 py-2 bg-white dark:bg-zinc-800 border dark:border-zinc-700 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required 
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full flex items-center justify-center py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-md font-medium transition-colors"
          >
            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "로그인"}
          </button>
        </form>
      </div>
      
      <div className="px-6 py-4 bg-gray-50 dark:bg-zinc-800/50 border-t dark:border-zinc-800 text-center">
        <p className="text-sm text-gray-500 dark:text-zinc-400">
          계정이 없으신가요?{" "}
          <Link href="/signup" className="text-blue-600 dark:text-blue-400 hover:underline">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50 dark:bg-zinc-950">
      <Suspense fallback={<div className="dark:text-white">로딩 중...</div>}>
        <LoginForm />
      </Suspense>
    </div>
  );
}