"use client";
// src/components/MobileBottomNav.tsx
// ✅ 개선판: 채팅 미읽음 뱃지 추가 + 실시간 소켓 업데이트

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  LayoutDashboard,
  MessageCircle,
  Bell,
  Search,
  User,
} from "lucide-react";
import { getOrCreateSocket } from "@/hooks/useSocket";

const TABS = [
  { href: "/dashboard",     icon: LayoutDashboard, label: "홈",    tour: "dashboard" },
  { href: "/search",        icon: Search,          label: "검색",  tour: "search" },
  { href: "/chat",          icon: MessageCircle,   label: "채팅",  tour: "chat" },
  { href: "/notifications", icon: Bell,            label: "알림",  tour: "notifications" },
  { href: "/profile",       icon: User,            label: "프로필", tour: "profile" },
];

export default function MobileBottomNav() {
  const pathname            = usePathname();
  const { data: session }   = useSession();
  const [unreadNotif, setUnreadNotif] = useState(0);
  const [unreadChat,  setUnreadChat]  = useState(0);

  // ── 알림 미읽음 수 ─────────────────────────────────────
  const fetchNotifCount = useCallback(async () => {
    try {
      const r = await fetch("/api/notifications?limit=1");
      const d = await r.json();
      setUnreadNotif(d.unreadCount ?? 0);
    } catch {}
  }, []);

  // ── 채팅 미읽음 수 ─────────────────────────────────────
  const fetchChatCount = useCallback(async () => {
    try {
      const r = await fetch("/api/chat/rooms");
      const d = await r.json();
      const total = (d.chatRooms ?? []).reduce(
        (sum: number, room: any) => sum + (room.unreadCount || 0),
        0
      );
      setUnreadChat(total);
    } catch {}
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    fetchNotifCount();
    fetchChatCount();

    // 30초마다 폴링
    const timer = setInterval(() => {
      fetchNotifCount();
      fetchChatCount();
    }, 30_000);
    return () => clearInterval(timer);
  }, [pathname, session?.user, fetchNotifCount, fetchChatCount]);

  // ── 실시간 소켓: 새 메시지 → 채팅 뱃지 즉시 업데이트 ──
  useEffect(() => {
    if (!session?.user?.id) return;
    const socket = getOrCreateSocket(session.user.id);

    const handleMsg = (data: any) => {
      // 현재 채팅방 안에 있으면 카운트 증가 안 함
      const isInCurrentRoom =
        pathname.startsWith("/chat/") &&
        pathname.endsWith(data.chatRoomId ?? "");
      if (!isInCurrentRoom && data.senderId !== session.user?.id) {
        setUnreadChat((c) => c + 1);
      }
    };

    const handleNotif = () => setUnreadNotif((n) => n + 1);

    socket.on("message:receive", handleMsg);
    socket.on("message:new",     handleMsg);
    socket.on("notification:new", handleNotif);

    return () => {
      socket.off("message:receive", handleMsg);
      socket.off("message:new",     handleMsg);
      socket.off("notification:new", handleNotif);
    };
  }, [session?.user?.id, session?.user, pathname]);

  // 채팅방 입장 시 해당 채팅의 미읽음 초기화
  useEffect(() => {
    if (pathname.startsWith("/chat/")) {
      // 채팅방 입장하면 잠시 후 재조회
      const t = setTimeout(fetchChatCount, 1000);
      return () => clearTimeout(t);
    }
    // 알림 페이지 입장 시 알림 미읽음 초기화
    if (pathname === "/notifications") {
      const t = setTimeout(fetchNotifCount, 1000);
      return () => clearTimeout(t);
    }
  }, [pathname, fetchChatCount, fetchNotifCount]);

  // 로그인/공개 페이지에서는 숨김
  const hiddenPaths = ["/", "/login", "/register", "/share"];
  if (
    hiddenPaths.some(
      (p) => pathname === p || pathname.startsWith("/share/")
    )
  )
    return null;

  return (
    <>
      {/* 하단 여백 (콘텐츠가 탭에 가리지 않도록) */}
      <div className="h-20 md:hidden" aria-hidden />

      <nav
        className="fixed bottom-0 left-0 right-0 z-50 md:hidden
                   bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl
                   border-t border-gray-200 dark:border-slate-700
                   safe-area-padding-bottom"
      >
        <div className="flex items-center justify-around px-2 py-2 pb-safe">
          {TABS.map(({ href, icon: Icon, label, tour }) => {
            const isActive =
              pathname === href || pathname.startsWith(href + "/");
            const isBell  = href === "/notifications";
            const isChat  = href === "/chat";
            const badge   = isBell ? unreadNotif : isChat ? unreadChat : 0;

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

                {/* 아이콘 + 뱃지 */}
                <div className="relative">
                  <Icon
                    size={22}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className="transition-all"
                    fill={isActive ? "currentColor" : "none"}
                    style={{ fillOpacity: isActive ? 0.12 : 0 }}
                  />
                  {/* 미읽음 뱃지 (알림 & 채팅 공통) */}
                  {badge > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 leading-none">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </div>

                {/* 레이블 */}
                <span
                  className={`text-[10px] font-semibold leading-none truncate ${
                    isActive
                      ? "text-blue-600 dark:text-blue-400"
                      : "text-gray-500 dark:text-slate-400"
                  }`}
                >
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
