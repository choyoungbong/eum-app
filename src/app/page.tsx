"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Cloud, ShieldCheck, Zap, Share2, ArrowRight,
  MessageCircle, Search, Bell, Smartphone, Lock,
  HardDrive, Globe, CheckCircle2,
} from "lucide-react";

function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setInView(true); }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const { ref, inView } = useInView();
  useEffect(() => {
    if (!inView) return;
    const step = Math.ceil(to / 60);
    let cur = 0;
    const t = setInterval(() => {
      cur = Math.min(cur + step, to);
      setVal(cur);
      if (cur >= to) clearInterval(t);
    }, 16);
    return () => clearInterval(t);
  }, [inView, to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

const FEATURES = [
  {
    icon: HardDrive, color: "from-blue-500 to-cyan-400",
    title: "스마트 파일 관리",
    desc: "폴더 계층, 태그, 전문 검색으로 수천 개의 파일을 한눈에 정리하세요.",
    points: ["폴더 & 태그 기반 분류", "파일 미리보기 (이미지·영상·PDF)", "퍼미션 기반 선택 공유"],
  },
  {
    icon: MessageCircle, color: "from-purple-500 to-pink-400",
    title: "실시간 채팅 & 통화",
    desc: "텍스트, 파일 전송, 음성·영상 통화까지 하나의 앱에서 해결하세요.",
    points: ["WebRTC 음성·영상 통화", "채팅방 파일 첨부", "온라인 프레즌스 표시"],
  },
  {
    icon: ShieldCheck, color: "from-green-500 to-emerald-400",
    title: "강력한 보안",
    desc: "bcrypt 암호화, 세션 보호, 2단계 인증으로 데이터를 안전하게 지킵니다.",
    points: ["비밀번호 bcrypt 해싱", "TOTP 2단계 인증", "역할 기반 접근 제어"],
  },
  {
    icon: Bell, color: "from-orange-500 to-amber-400",
    title: "스마트 알림",
    desc: "댓글, 공유, 채팅, 통화 요청을 FCM 푸시로 실시간 수신하세요.",
    points: ["FCM 브라우저 푸시", "알림 종류별 개별 설정", "앱 내 알림 히스토리"],
  },
  {
    icon: Search, color: "from-indigo-500 to-violet-400",
    title: "통합 전문 검색",
    desc: "파일명, 게시글 본문, 태그, 작성자를 한 번에 검색하세요.",
    points: ["파일 + 게시글 통합 검색", "태그 필터링", "저장된 검색 조건"],
  },
  {
    icon: Smartphone, color: "from-rose-500 to-pink-400",
    title: "PWA 모바일 앱",
    desc: "홈 화면에 추가하면 네이티브 앱처럼 사용할 수 있습니다.",
    points: ["홈 화면 설치 지원", "오프라인 캐싱", "모바일 최적화 UI"],
  },
];

const STATS = [
  { value: 5120, suffix: "MB", label: "1인당 무료 저장용량" },
  { value: 50,   suffix: "MB", label: "최대 파일 업로드 크기" },
  { value: 99,   suffix: "%",  label: "업타임 목표" },
  { value: 2048, suffix: "+",  label: "지원 파일 형식" },
];

export default function HomePage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.push("/dashboard");
  }, [status, router]);

  if (status === "loading") return (
    <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0f0c29] text-white overflow-x-hidden selection:bg-purple-500/30">

      {/* 배경 */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[700px] h-[700px] bg-purple-700/20 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] bg-blue-700/15 rounded-full blur-[100px]" />
        <div className="absolute -bottom-40 left-1/3 w-[600px] h-[600px] bg-indigo-700/10 rounded-full blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: "linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px)", backgroundSize: "60px 60px" }} />
      </div>

      {/* 네비게이션 */}
      <nav className="sticky top-0 z-50 border-b border-white/5 backdrop-blur-xl bg-[#0f0c29]/80">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Cloud size={16} className="text-white" />
            </div>
            <span className="text-lg font-black tracking-tight">이음</span>
          </div>
          <div className="hidden md:flex items-center gap-6 text-sm text-white/50">
            <a href="#features" className="hover:text-white transition-colors">기능</a>
            <a href="#stats" className="hover:text-white transition-colors">사양</a>
            <a href="#tech" className="hover:text-white transition-colors">기술 스택</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login" className="px-4 py-2 text-sm font-semibold text-white/60 hover:text-white transition-colors">
              로그인
            </Link>
            <Link href="/register" className="px-4 py-2 text-sm font-bold bg-white text-black rounded-xl hover:bg-purple-50 transition-all">
              무료 시작
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6">

        {/* 히어로 */}
        <section className="pt-24 pb-32 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-purple-300 text-xs font-bold mb-10">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500" />
            </span>
            NEXT-GEN PERSONAL CLOUD
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-8 leading-[1.05] tracking-tight">
            사람과 파일을<br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-300 to-emerald-300">
              하나로 잇다
            </span>
          </h1>

          <p className="text-lg md:text-xl text-white/45 max-w-2xl mx-auto mb-14 leading-relaxed">
            파일 관리부터 실시간 채팅, WebRTC 통화, 스마트 검색까지.<br className="hidden md:block" />
            하나의 플랫폼에서 모든 것을 경험하세요.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20">
            <Link
              href="/register"
              className="group w-full sm:w-auto px-8 py-4 bg-white text-black font-black rounded-2xl hover:bg-purple-50 transition-all flex items-center justify-center gap-2 shadow-xl shadow-white/10"
            >
              지금 무료로 시작하기
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
            >
              기능 둘러보기
            </a>
          </div>

          {/* 미리보기 모형 */}
          <div className="relative max-w-3xl mx-auto">
            <div className="relative bg-white/5 border border-white/10 rounded-[28px] p-1 shadow-2xl shadow-purple-900/20">
              <div className="bg-slate-900/80 rounded-[22px] p-4 text-left">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-green-500/70" />
                  <div className="flex-1 mx-4 h-6 bg-white/5 rounded-full" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["📁 Documents", "🖼️ Photos", "🎬 Videos", "📄 Reports", "🎵 Music", "📊 Data"].map((name) => (
                    <div key={name} className="bg-white/5 rounded-xl p-3 flex items-center gap-2 border border-white/5">
                      <span className="text-sm">{name.split(" ")[0]}</span>
                      <span className="text-xs text-white/40 truncate">{name.split(" ").slice(1).join(" ")}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <div className="flex-1 h-10 bg-blue-500/20 rounded-xl border border-blue-500/30 flex items-center px-3 gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    <span className="text-xs text-white/40">김철수님과 채팅 중...</span>
                  </div>
                  <div className="w-10 h-10 bg-purple-500/20 rounded-xl border border-purple-500/30 flex items-center justify-center">
                    <Bell size={14} className="text-purple-300" />
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -inset-4 bg-gradient-to-r from-purple-600/20 via-blue-600/10 to-emerald-600/20 rounded-[40px] blur-2xl -z-10" />
          </div>
        </section>

        {/* 통계 */}
        <section id="stats" className="py-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {STATS.map(({ value, suffix, label }) => (
              <div key={label} className="text-center p-6 rounded-[24px] bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all">
                <p className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-purple-300 to-blue-300">
                  <CountUp to={value} suffix={suffix} />
                </p>
                <p className="text-white/40 text-xs font-medium">{label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 기능 */}
        <section id="features" className="py-20">
          <div className="text-center mb-16">
            <p className="text-purple-400 text-xs font-bold uppercase tracking-widest mb-4">FEATURES</p>
            <h2 className="text-4xl md:text-5xl font-black mb-4">필요한 모든 것이<br />한 곳에</h2>
            <p className="text-white/40 max-w-xl mx-auto">개인 스토리지를 넘어서는 올인원 생산성 플랫폼</p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map(({ icon: Icon, color, title, desc, points }) => (
              <div key={title} className="group p-6 rounded-[24px] bg-white/5 border border-white/10 hover:border-white/20 hover:-translate-y-1 transition-all duration-300">
                <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon size={22} className="text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2">{title}</h3>
                <p className="text-white/40 text-sm leading-relaxed mb-4">{desc}</p>
                <ul className="space-y-1.5">
                  {points.map((pt) => (
                    <li key={pt} className="flex items-center gap-2 text-xs text-white/50">
                      <CheckCircle2 size={12} className="text-emerald-400 shrink-0" />
                      {pt}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* 기술 스택 */}
        <section id="tech" className="py-20">
          <div className="relative p-10 rounded-[40px] bg-gradient-to-b from-white/8 to-transparent border border-white/10 overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
              <Globe size={160} />
            </div>
            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-10">
                <CheckCircle2 className="text-emerald-400" size={22} />
                <h3 className="text-2xl font-black tracking-tight">SYSTEM OPERATIONAL</h3>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-6">
                {[
                  { label: "Framework", value: "Next.js 14" },
                  { label: "Database",  value: "PostgreSQL" },
                  { label: "ORM",       value: "Prisma 5" },
                  { label: "Auth",      value: "NextAuth.js" },
                  { label: "Realtime",  value: "Socket.IO" },
                  { label: "Security",  value: "bcrypt + TOTP" },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="text-white/25 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</p>
                    <p className="text-white font-mono text-sm font-semibold">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-black mb-6">지금 바로 시작하세요</h2>
          <p className="text-white/40 mb-10 max-w-md mx-auto">신용카드 불필요. 5GB 무료 스토리지로 바로 시작하세요.</p>
          <Link
            href="/register"
            className="group inline-flex items-center gap-2 px-10 py-5 bg-white text-black font-black rounded-2xl hover:bg-purple-50 transition-all text-lg shadow-2xl shadow-white/10"
          >
            무료로 시작하기
            <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </section>
      </div>

      {/* 푸터 */}
      <footer className="border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
              <Cloud size={12} className="text-white" />
            </div>
            <span className="text-sm font-bold text-white/40">이음 (Eum)</span>
          </div>
          <p className="text-white/20 text-xs font-medium tracking-widest uppercase">
            © 2026 EUM CLOUD SERVICE. ALL RIGHTS RESERVED.
          </p>
          <div className="flex gap-4 text-xs text-white/30">
            <Link href="/login" className="hover:text-white/60 transition-colors">로그인</Link>
            <Link href="/register" className="hover:text-white/60 transition-colors">회원가입</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
