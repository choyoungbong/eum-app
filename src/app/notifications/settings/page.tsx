"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Bell, BellOff, ChevronLeft, MessageSquare, Share2,
  MessageCircle, Phone, Info, FileUp, Mail, RefreshCw,
} from "lucide-react";
import { registerFCMToken, unregisterFCMToken } from "@/lib/firebase";
import { toast } from "@/components/Toast";

interface NotificationPreferences {
  pushEnabled: boolean;
  comment:     boolean;
  share:       boolean;
  chat:        boolean;
  call:        boolean;
  system:      boolean;
  fileUpload:  boolean;
  emailDigest: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  pushEnabled: true,
  comment:     true,
  share:       true,
  chat:        true,
  call:        true,
  system:      true,
  fileUpload:  false,
  emailDigest: false,
};

interface SettingItem {
  key: keyof NotificationPreferences;
  label: string;
  desc: string;
  icon: React.ElementType;
  color: string;
  bg: string;
  requiresPush?: boolean; // pushEnabled가 false면 비활성화
}

const SETTINGS: SettingItem[] = [
  {
    key: "comment", label: "댓글 알림", requiresPush: true,
    desc: "내 게시글에 새 댓글이 달렸을 때",
    icon: MessageSquare, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/30",
  },
  {
    key: "share", label: "공유 알림", requiresPush: true,
    desc: "파일이나 폴더가 공유되었을 때",
    icon: Share2, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/30",
  },
  {
    key: "chat", label: "채팅 알림", requiresPush: true,
    desc: "새 채팅 메시지가 도착했을 때",
    icon: MessageCircle, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/30",
  },
  {
    key: "call", label: "통화 알림", requiresPush: true,
    desc: "음성/영상 통화 요청이 들어왔을 때",
    icon: Phone, color: "text-red-600", bg: "bg-red-50 dark:bg-red-900/30",
  },
  {
    key: "system", label: "시스템 알림", requiresPush: true,
    desc: "서비스 공지 및 중요 안내",
    icon: Info, color: "text-gray-600", bg: "bg-gray-50 dark:bg-gray-800",
  },
  {
    key: "fileUpload", label: "파일 업로드 완료", requiresPush: true,
    desc: "대용량 파일 업로드가 완료되었을 때",
    icon: FileUp, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30",
  },
  {
    key: "emailDigest", label: "이메일 주간 요약",
    desc: "매주 활동 요약을 이메일로 받기 (준비 중)",
    icon: Mail, color: "text-indigo-600", bg: "bg-indigo-50 dark:bg-indigo-900/30",
  },
];

// ─── Toggle 버튼 ─────────────────────────────────────
function Toggle({
  enabled, onToggle, disabled = false,
}: {
  enabled: boolean; onToggle: () => void; disabled?: boolean;
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      aria-checked={enabled}
      role="switch"
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors
        focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
        ${enabled ? "bg-blue-600" : "bg-gray-200 dark:bg-slate-600"}
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform
          ${enabled ? "translate-x-6" : "translate-x-1"}`}
      />
    </button>
  );
}

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | null>(null);

  // 브라우저 알림 권한 상태
  useEffect(() => {
    if ("Notification" in window) {
      setBrowserPermission(Notification.permission);
    }
  }, []);

  // 서버에서 설정 불러오기
  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((d) => setPrefs({ ...DEFAULT_PREFS, ...d.prefs }))
      .catch(() => toast.error("설정을 불러오지 못했습니다"))
      .finally(() => setLoading(false));
  }, []);

  // 개별 토글 저장 (debounce 없이 즉시 저장)
  const toggle = async (key: keyof NotificationPreferences) => {
    const newPrefs = { ...prefs, [key]: !prefs[key] };
    setPrefs(newPrefs);
    setSaving(true);
    try {
      await fetch("/api/notifications/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newPrefs),
      });
    } catch {
      // 실패 시 롤백
      setPrefs(prefs);
      toast.error("설정 저장에 실패했습니다");
    } finally {
      setSaving(false);
    }
  };

  // 푸시 전체 토글 (FCM 연동 포함)
  const togglePush = async () => {
    setSaving(true);
    if (prefs.pushEnabled) {
      await unregisterFCMToken();
      await toggle("pushEnabled");
    } else {
      if (browserPermission === "denied") {
        toast.error("브라우저 설정에서 알림 권한을 허용한 뒤 다시 시도해주세요.");
        setSaving(false);
        return;
      }
      const success = await registerFCMToken();
      if (success) {
        setBrowserPermission("granted");
        await toggle("pushEnabled");
      } else {
        toast.error("알림 권한을 허용해주세요.");
      }
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* 헤더 */}
      <div className="bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link
            href="/profile"
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-slate-400" />
          </Link>
          <Bell size={20} className="text-gray-800 dark:text-slate-200" />
          <h1 className="text-lg font-semibold text-gray-900 dark:text-slate-100 flex-1">
            알림 설정
          </h1>
          {saving && (
            <RefreshCw size={14} className="animate-spin text-blue-500" />
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">

        {/* 브라우저 권한 경고 */}
        {browserPermission === "denied" && (
          <div className="flex items-start gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
            <BellOff size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-400">
                브라우저 알림이 차단됨
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-500 mt-0.5">
                주소창 왼쪽 자물쇠 아이콘 → 알림 → 허용으로 변경 후 새로고침하세요.
              </p>
            </div>
          </div>
        )}

        {/* 푸시 알림 마스터 토글 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Bell size={20} className="text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-slate-100">
                  푸시 알림 전체
                </p>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                  앱을 닫아도 알림을 받습니다
                </p>
              </div>
            </div>
            <Toggle
              enabled={prefs.pushEnabled}
              onToggle={togglePush}
              disabled={loading || browserPermission === "denied"}
            />
          </div>
        </div>

        {/* 알림 종류별 설정 */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-100 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">
              알림 종류
            </p>
          </div>

          {loading ? (
            <div className="p-8 flex justify-center">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
            </div>
          ) : (
            <div className="divide-y divide-gray-100 dark:divide-slate-700">
              {SETTINGS.map(({ key, label, desc, icon: Icon, color, bg, requiresPush }) => {
                const isDisabled = requiresPush && !prefs.pushEnabled;
                return (
                  <div
                    key={key}
                    className={`flex items-center gap-3 px-5 py-4 transition-colors
                      ${isDisabled ? "opacity-50" : "hover:bg-gray-50 dark:hover:bg-slate-700/50"}`}
                  >
                    <div className={`w-9 h-9 rounded-full ${bg} flex items-center justify-center shrink-0`}>
                      <Icon size={16} className={color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                        {label}
                        {key === "emailDigest" && (
                          <span className="ml-2 text-[10px] font-semibold bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-1.5 py-0.5 rounded">
                            준비 중
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{desc}</p>
                    </div>
                    <Toggle
                      enabled={prefs[key]}
                      onToggle={() => toggle(key)}
                      disabled={loading || saving || isDisabled || key === "emailDigest"}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 안내 */}
        <p className="text-xs text-center text-gray-400 dark:text-slate-500 pb-4">
          설정은 자동으로 저장됩니다. 변경 사항은 즉시 반영됩니다.
        </p>
      </div>
    </div>
  );
}
