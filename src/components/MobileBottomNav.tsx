"use client";
// src/components/MobileBottomNav.tsx
// 모바일에서만 보이는 하단 탭 네비게이션
// layout.tsx 또는 dashboard layout에 추가

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard, MessageCircle, Bell, Search, User,
} from "lucide-react";

const TABS = [
  { href: "/dashboard",   icon: LayoutDashboard, label: "홈",    tour: "dashboard" },
  { href: "/search",      icon: Search,          label: "검색",  tour: "search" },
  { href: "/chat",        icon: MessageCircle,   label: "채팅",  tour: "chat" },
  { href: "/notifications", icon: Bell,          label: "알림",  tour: "notifications" },
  { href: "/profile",     icon: User,            label: "프로필", tour: "profile" },
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  // 알림 뱃지
  useEffect(() => {
    fetch("/api/notifications?limit=1")
      .then((r) => r.json())
      .then((d) => setUnread(d.unreadCount ?? 0))
      .catch(() => {});
  }, [pathname]);

  // 로그인/공개 페이지에서는 숨김
  const hiddenPaths = ["/", "/login", "/register", "/share"];
  if (hiddenPaths.some((p) => pathname === p || pathname.startsWith("/share/"))) return null;

  return (
    <>
      {/* 하단 여백 (콘텐츠가 탭에 가리지 않도록) */}
      <div className="h-20 md:hidden" aria-hidden />

      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                      bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
                      border-t border-gray-200 dark:border-slate-700
                      safe-area-padding-bottom">
        <div className="flex items-center justify-around px-2 py-2 pb-safe">
          {TABS.map(({ href, icon: Icon, label, tour }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            const isBell   = href === "/notifications";
            return (
              <Link
                key={href}
                href={href}
                data-tour={tour}
                className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all min-w-0 flex-1 ${
                  isActive
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300"
                }`}
              >
                {/* 활성 인디케이터 */}
                {isActive && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full" />
                )}
                {/* 아이콘 */}
                <div className="relative">
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className="transition-all"
                    fill={isActive ? "currentColor" : "none"}
                    style={{ fillOpacity: isActive ? 0.12 : 0 }}
                  />
                  {/* 알림 뱃지 */}
                  {isBell && unread > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </div>
                {/* 레이블 */}
                <span className={`text-[10px] font-semibold leading-none truncate ${
                  isActive ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-slate-400"
                }`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
