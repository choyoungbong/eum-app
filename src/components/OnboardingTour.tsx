"use client";
// src/components/OnboardingTour.tsx
// 첫 로그인 시 자동 표시되는 단계별 가이드
// providers.tsx 또는 dashboard layout에 추가

import { useState, useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { X, ChevronRight, ChevronLeft, Check } from "lucide-react";

const STEPS = [
  {
    title: "🎉 이음에 오신 것을 환영합니다!",
    desc: "이음은 파일 관리, 실시간 채팅, 협업을 하나의 공간에서 제공하는 퍼스널 클라우드입니다.",
    target: null,
    position: "center" as const,
  },
  {
    title: "📁 파일 업로드",
    desc: "대시보드에서 파일을 드래그 앤 드롭하거나 클릭하여 업로드하세요. 이미지, 영상, 문서 등 모든 형식을 지원합니다.",
    target: "[data-tour='upload']",
    position: "bottom" as const,
  },
  {
    title: "💬 실시간 채팅",
    desc: "다른 사용자와 채팅하고 파일을 공유하세요. 음성·영상 통화도 지원합니다.",
    target: "[data-tour='chat']",
    position: "right" as const,
  },
  {
    title: "🔔 알림 설정",
    desc: "댓글, 공유, 메시지 등 알림을 종류별로 설정할 수 있습니다.",
    target: "[data-tour='notifications']",
    position: "bottom" as const,
  },
  {
    title: "🔒 보안",
    desc: "2단계 인증(2FA)을 설정하고, 개별 파일에 비밀번호를 걸어 더 안전하게 보호하세요.",
    target: "[data-tour='profile']",
    position: "left" as const,
  },
  {
    title: "✅ 준비 완료!",
    desc: "이음 사용을 시작할 준비가 되었습니다. 언제든지 프로필 → 도움말에서 이 가이드를 다시 볼 수 있습니다.",
    target: null,
    position: "center" as const,
  },
];

function getTargetRect(selector: string | null): DOMRect | null {
  if (!selector) return null;
  return document.querySelector(selector)?.getBoundingClientRect() ?? null;
}

export default function OnboardingTour() {
  const { data: session } = useSession();
  const [step, setStep]   = useState(0);
  const [visible, setVisible] = useState(false);
  const [rect, setRect]   = useState<DOMRect | null>(null);
  const [done, setDone]   = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    const key = `onboarding_done_${session.user.id}`;
    if (localStorage.getItem(key)) { setDone(true); return; }
    // 첫 로그인이면 0.8초 후 투어 시작
    const t = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(t);
  }, [session]);

  useEffect(() => {
    if (!visible) return;
    const current = STEPS[step];
    setRect(getTargetRect(current.target));
  }, [step, visible]);

  const finish = () => {
    if (session?.user) {
      localStorage.setItem(`onboarding_done_${session.user.id}`, "1");
      // API로도 기록
      fetch("/api/users/me/onboarding", { method: "POST" }).catch(() => {});
    }
    setVisible(false);
    setDone(true);
  };

  if (!visible || done) return null;

  const current = STEPS[step];
  const isFirst = step === 0;
  const isLast  = step === STEPS.length - 1;

  // 타깃 요소가 있으면 스포트라이트, 없으면 중앙 모달
  const isCentered = current.position === "center" || !rect;

  return (
    <div className="fixed inset-0 z-[9998]">
      {/* 배경 오버레이 */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={() => {}} />

      {/* 스포트라이트 컷아웃 */}
      {rect && (
        <div
          className="absolute rounded-xl ring-4 ring-blue-400 ring-offset-2 bg-transparent z-[9999] pointer-events-none transition-all duration-300"
          style={{
            top:    rect.top    - 8,
            left:   rect.left   - 8,
            width:  rect.width  + 16,
            height: rect.height + 16,
          }}
        />
      )}

      {/* 툴팁/모달 */}
      <div
        className={`absolute z-[9999] w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-slate-700 p-5 transition-all duration-300 ${
          isCentered
            ? "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            : ""
        }`}
        style={
          !isCentered && rect
            ? current.position === "bottom"
              ? { top: rect.bottom + 16, left: Math.min(rect.left, window.innerWidth - 340) }
              : current.position === "right"
              ? { top: rect.top, left: rect.right + 16 }
              : { top: rect.top, right: window.innerWidth - rect.left + 16 }
            : {}
        }
      >
        {/* 닫기 */}
        <button onClick={finish} className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition-colors">
          <X size={16} />
        </button>

        {/* 진행 도트 */}
        <div className="flex gap-1.5 mb-4">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${
              i === step ? "w-6 bg-blue-600" : i < step ? "w-1.5 bg-blue-300" : "w-1.5 bg-gray-200 dark:bg-slate-700"
            }`} />
          ))}
        </div>

        <h3 className="text-base font-bold text-gray-900 dark:text-slate-100 mb-2 pr-5">{current.title}</h3>
        <p className="text-sm text-gray-500 dark:text-slate-400 leading-relaxed mb-5">{current.desc}</p>

        {/* 버튼 */}
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button onClick={() => setStep((s) => s - 1)}
              className="flex items-center gap-1 px-3 py-2 text-xs font-medium text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl transition">
              <ChevronLeft size={14} /> 이전
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={() => isLast ? finish() : setStep((s) => s + 1)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
          >
            {isLast ? <><Check size={14} /> 시작하기</> : <>다음 <ChevronRight size={14} /></>}
          </button>
        </div>

        <button onClick={finish} className="mt-3 w-full text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-slate-400 text-center">
          건너뛰기
        </button>
      </div>
    </div>
  );
}
