"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft, ChevronRight, MessageSquare, Zap,
  BarChart2, Coins, Globe, Users, Clock,
} from "lucide-react";
import { toast } from "@/components/Toast";

interface Room {
  id: string; name: string; type: string; createdAt: string;
  meta: { category?: string; description?: string };
  _count: { messages: number };
  messages: { content: string; createdAt: string; user: { name: string } }[];
}

const CATEGORY_STYLE: Record<string, { color: string; bg: string; icon: any }> = {
  KOSPI:  { color: "text-blue-400",    bg: "bg-blue-500/10",    icon: BarChart2 },
  KOSDAQ: { color: "text-emerald-400", bg: "bg-emerald-500/10", icon: BarChart2 },
  NASDAQ: { color: "text-violet-400",  bg: "bg-violet-500/10",  icon: Globe },
  CRYPTO: { color: "text-yellow-400",  bg: "bg-yellow-500/10",  icon: Coins },
  FREE:   { color: "text-zinc-400",    bg: "bg-zinc-700/40",    icon: MessageSquare },
};

const timeAgo = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
};

export default function ReadingRoomsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "unauthenticated") router.push("/login");
  }, [status, router]);

  useEffect(() => {
    if (!session) return;
    fetch("/api/invest/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(d.rooms ?? []))
      .catch(() => toast.error("리딩방 목록을 불러오지 못했습니다"))
      .finally(() => setLoading(false));
  }, [session]);

  if (status === "loading") {
    return <div className="min-h-screen flex items-center justify-center bg-zinc-950"><div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" /></div>;
  }
  if (!session) return null;

  const aiRooms   = rooms.filter((r) => r.type === "AI_SIGNAL");
  const freeRooms = rooms.filter((r) => r.type === "COMMUNITY");

  const RoomCard = ({ room }: { room: Room }) => {
    const cat   = room.meta.category ?? "FREE";
    const style = CATEGORY_STYLE[cat] ?? CATEGORY_STYLE.FREE;
    const Icon  = style.icon;
    const last  = room.messages[0];

    return (
      <Link href={`/invest/reading/${room.id}`}
        className="group flex items-center gap-4 p-4 bg-white/3 hover:bg-white/5 border border-white/6 hover:border-white/10 rounded-2xl transition-all">
        {/* 아이콘 */}
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${style.bg}`}>
          <Icon size={20} className={style.color} />
        </div>

        {/* 정보 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-sm text-zinc-200 group-hover:text-white transition-colors truncate">
              {room.name}
            </p>
            {room.type === "AI_SIGNAL" && (
              <span className="shrink-0 flex items-center gap-0.5 px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
                <Zap size={8} /> AI
              </span>
            )}
          </div>
          <p className="text-[11px] text-zinc-600 mt-0.5 truncate">
            {last ? `${last.user.name}: ${last.content}` : room.meta.description ?? ""}
          </p>
        </div>

        {/* 우측 메타 */}
        <div className="shrink-0 text-right space-y-1">
          {last && <p className="text-[10px] text-zinc-700"><Clock size={8} className="inline mr-0.5" />{timeAgo(last.createdAt)}</p>}
          <p className="text-[10px] text-zinc-600 flex items-center gap-1 justify-end">
            <MessageSquare size={9} />{room._count.messages}
          </p>
        </div>

        <ChevronRight size={14} className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0" />
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/3 w-80 h-80 bg-emerald-600/4 rounded-full blur-3xl" />
      </div>

      {/* 헤더 */}
      <header className="sticky top-0 z-20 bg-zinc-950/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/invest" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors text-zinc-400 hover:text-zinc-200">
            <ChevronLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-violet-600 flex items-center justify-center">
              <Zap size={13} className="text-white" />
            </div>
            <h1 className="text-lg font-bold tracking-tight">AI 리딩방</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 relative space-y-6">
        {loading ? (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-white/3 rounded-2xl border border-white/4">
                <div className="w-12 h-12 bg-white/6 rounded-2xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-white/6 rounded w-1/2" />
                  <div className="h-3 bg-white/4 rounded w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* AI 리딩방 섹션 */}
            {aiRooms.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <Zap size={11} className="text-emerald-400" />
                    <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wider">AI Signal Rooms</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {aiRooms.map((r) => <RoomCard key={r.id} room={r} />)}
                </div>
              </section>
            )}

            {/* 커뮤니티 방 섹션 */}
            {freeRooms.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-1.5 px-2.5 py-1 bg-zinc-800 rounded-lg border border-zinc-700">
                    <Users size={11} className="text-zinc-400" />
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Community Rooms</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {freeRooms.map((r) => <RoomCard key={r.id} room={r} />)}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}
