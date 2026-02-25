"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ChevronLeft, Shield, ShieldCheck, ShieldOff, Copy, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { toast } from "@/components/Toast";

type Step = "idle" | "qr" | "verify" | "backup" | "disable";

interface SetupData {
  qrCode: string;
  manualKey: string;
}

export default function TwoFactorPage() {
  const [isEnabled, setIsEnabled] = useState(false); // 실제론 API에서 가져와야 함
  const [step, setStep] = useState<Step>("idle");
  const [setupData, setSetupData] = useState<SetupData | null>(null);
  const [otp, setOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showManualKey, setShowManualKey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  // 초기 상태 로드
  useState(() => {
    fetch("/api/users/me")
      .then((r) => r.json())
      .then((d) => setIsEnabled(d.twoFactorEnabled ?? false))
      .catch(() => {});
  });

  // QR코드 생성 요청
  const startSetup = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSetupData({ qrCode: data.qrCode, manualKey: data.manualKey });
      setStep("qr");
    } catch (e: any) {
      toast.error(e.message || "QR코드 생성에 실패했습니다");
    } finally {
      setLoading(false);
    }
  };

  // OTP 검증 및 활성화
  const verifyAndActivate = async () => {
    if (otp.replace(/\s/g, "").length !== 6) {
      toast.error("6자리 코드를 입력해주세요");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: otp }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setBackupCodes(data.backupCodes);
      setIsEnabled(true);
      setStep("backup");
      setOtp("");
    } catch (e: any) {
      toast.error(e.message || "코드가 올바르지 않습니다");
    } finally {
      setLoading(false);
    }
  };

  // 2FA 비활성화
  const disable2FA = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: disableCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setIsEnabled(false);
      setStep("idle");
      setDisableCode("");
      toast.success("2단계 인증이 비활성화되었습니다");
    } catch (e: any) {
      toast.error(e.message || "코드가 올바르지 않습니다");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("복사되었습니다");
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/profile" className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors">
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <Shield size={20} className="text-gray-800 dark:text-slate-200" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">
            2단계 인증
          </h1>
          {isEnabled && (
            <span className="flex items-center gap-1 text-xs font-semibold text-green-600 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full">
              <ShieldCheck size={12} /> 활성화됨
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* ── IDLE: 현재 상태 + 시작 버튼 ── */}
        {step === "idle" && (
          <>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6">
              <div className="flex items-start gap-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                  isEnabled ? "bg-green-50 dark:bg-green-900/30" : "bg-gray-100 dark:bg-slate-700"
                }`}>
                  {isEnabled
                    ? <ShieldCheck size={24} className="text-green-600" />
                    : <Shield size={24} className="text-gray-500 dark:text-slate-400" />
                  }
                </div>
                <div>
                  <p className="font-semibold text-gray-900 dark:text-slate-100">
                    {isEnabled ? "2단계 인증 활성화됨" : "2단계 인증 비활성화"}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {isEnabled
                      ? "로그인 시 인증 앱의 6자리 코드가 필요합니다."
                      : "TOTP 인증 앱(Google Authenticator, Authy 등)을 사용해 계정을 더욱 안전하게 보호하세요."}
                  </p>
                </div>
              </div>
            </div>

            {!isEnabled ? (
              <button
                onClick={startSetup}
                disabled={loading}
                className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition"
              >
                {loading ? "준비 중..." : "2단계 인증 설정 시작"}
              </button>
            ) : (
              <button
                onClick={() => setStep("disable")}
                className="w-full py-3 text-sm font-semibold text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-xl border border-red-200 dark:border-red-800 transition"
              >
                2단계 인증 비활성화
              </button>
            )}
          </>
        )}

        {/* ── QR코드 단계 ── */}
        {step === "qr" && setupData && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">① 앱으로 QR코드 스캔</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                Google Authenticator, Authy, Microsoft Authenticator 등의 앱을 열고 아래 QR코드를 스캔하세요.
              </p>
              <div className="flex justify-center">
                <div className="p-3 bg-white rounded-xl shadow">
                  <img src={setupData.qrCode} alt="QR Code" className="w-48 h-48" />
                </div>
              </div>

              {/* 수동 입력 키 */}
              <div>
                <button
                  onClick={() => setShowManualKey(!showManualKey)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {showManualKey ? <EyeOff size={12} /> : <Eye size={12} />}
                  QR코드 스캔이 안 된다면 (수동 입력)
                </button>
                {showManualKey && (
                  <div className="mt-2 flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-900 rounded-lg">
                    <code className="text-xs font-mono text-gray-700 dark:text-slate-300 flex-1 break-all">
                      {setupData.manualKey}
                    </code>
                    <button
                      onClick={() => copyToClipboard(setupData.manualKey)}
                      className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-700 rounded"
                    >
                      <Copy size={12} className="text-gray-500" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setStep("verify")}
              className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
            >
              다음 → 코드 확인
            </button>
            <button onClick={() => setStep("idle")} className="w-full py-2 text-sm text-gray-500 dark:text-slate-400">
              취소
            </button>
          </div>
        )}

        {/* ── OTP 검증 단계 ── */}
        {step === "verify" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-4">
              <h2 className="font-semibold text-gray-900 dark:text-slate-100">② 인증 코드 확인</h2>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                앱에 표시된 6자리 코드를 입력하여 설정을 완료하세요.
              </p>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                placeholder="6자리 코드"
                className="w-full text-center text-2xl font-mono tracking-[0.5em] border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <button
              onClick={verifyAndActivate}
              disabled={loading || otp.length !== 6}
              className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-xl transition"
            >
              {loading ? "확인 중..." : "인증 완료"}
            </button>
            <button onClick={() => setStep("qr")} className="w-full py-2 text-sm text-gray-500 dark:text-slate-400">
              ← 이전
            </button>
          </div>
        )}

        {/* ── 백업 코드 단계 ── */}
        {step === "backup" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-green-600" />
                <h2 className="font-semibold text-green-700 dark:text-green-400">2단계 인증 활성화 완료!</h2>
              </div>

              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  아래 백업 코드를 안전한 곳에 저장하세요. 인증 앱을 잃어버렸을 때 사용할 수 있으며 각 코드는 1회만 사용 가능합니다.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {backupCodes.map((code) => (
                  <div key={code} className="font-mono text-sm text-center py-2 px-3 bg-gray-50 dark:bg-slate-900 rounded-lg text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
                    {code}
                  </div>
                ))}
              </div>

              <button
                onClick={() => copyToClipboard(backupCodes.join("\n"))}
                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition"
              >
                <Copy size={14} /> 전체 복사
              </button>
            </div>

            <button
              onClick={() => setStep("idle")}
              className="w-full py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
            >
              완료
            </button>
          </div>
        )}

        {/* ── 비활성화 단계 ── */}
        {step === "disable" && (
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-6 space-y-4">
              <div className="flex items-center gap-2">
                <ShieldOff size={20} className="text-red-500" />
                <h2 className="font-semibold text-gray-900 dark:text-slate-100">2단계 인증 비활성화</h2>
              </div>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                인증 앱의 6자리 코드 또는 백업 코드를 입력하세요.
              </p>
              <input
                type="text"
                value={disableCode}
                onChange={(e) => setDisableCode(e.target.value.replace(/\s/g, "").toUpperCase())}
                placeholder="코드 입력"
                className="w-full text-center text-xl font-mono tracking-widest border border-gray-200 dark:border-slate-600 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-red-400 bg-white dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <button
              onClick={disable2FA}
              disabled={loading || disableCode.length < 6}
              className="w-full py-3 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 rounded-xl transition"
            >
              {loading ? "처리 중..." : "비활성화 확인"}
            </button>
            <button onClick={() => setStep("idle")} className="w-full py-2 text-sm text-gray-500 dark:text-slate-400">
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
