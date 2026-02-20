"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Link from "next/link";
import { 
  Cloud, 
  ShieldCheck, 
  Zap, 
  Share2, 
  ArrowRight, 
  CheckCircle2,
  Lock,
  Globe
} from "lucide-react";

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
      <div className="min-h-screen bg-[#0f0c29] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0c29] text-white selection:bg-purple-500/30 overflow-x-hidden">
      {/* 배경 장식 (Blobs) */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-purple-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-600/20 blur-[120px] rounded-full" />
      </div>

      <div className="max-w-6xl mx-auto px-6 py-20 relative">
        {/* 상단 네비게이션 스타일 헤더 */}
        <nav className="flex justify-between items-center mb-24">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Cloud size={24} fill="currentColor" />
            </div>
            <span className="text-xl font-black tracking-tighter italic">EUM CLOUD</span>
          </div>
          <div className="flex gap-4">
            <Link href="/login" className="px-5 py-2 text-sm font-bold text-white/70 hover:text-white transition-colors">
              로그인
            </Link>
            <Link href="/register" className="px-5 py-2 text-sm font-bold bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-all">
              시작하기
            </Link>
          </div>
        </nav>

        {/* 히어로 섹션 */}
        <div className="text-center mb-32">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-purple-400 text-xs font-bold mb-8 animate-fade-in">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
            </span>
            NEXT-GEN PERSONAL CLOUD
          </div>
          <h1 className="text-5xl md:text-7xl font-black mb-8 leading-[1.1] tracking-tight">
            데이터의 연결, <br />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-400 via-blue-400 to-emerald-400">
              그 이상의 가치 이음
            </span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 max-w-2xl mx-auto mb-12 leading-relaxed">
            나만의 퍼스널 스토리지를 넘어 실시간 미디어 스트리밍과 <br className="hidden md:block" /> 
            강력한 협업 도구를 하나의 생태계에서 경험하세요.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="group w-full sm:w-auto px-8 py-4 bg-white text-black font-black rounded-2xl hover:bg-purple-50 transition-all flex items-center justify-center gap-2"
            >
              무료로 시작하기
              <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/about"
              className="w-full sm:w-auto px-8 py-4 bg-white/5 text-white font-bold rounded-2xl border border-white/10 hover:bg-white/10 transition-all"
            >
              기능 둘러보기
            </Link>
          </div>
        </div>

        {/* 기능 카드 섹션 */}
        <div className="grid md:grid-cols-3 gap-6 mb-32">
          {[
            { icon: <ShieldCheck className="text-purple-400" />, title: "강력한 보안", desc: "엔드 투 엔드 암호화로 오직 당신만이 데이터에 접근할 수 있습니다." },
            { icon: <Zap className="text-blue-400" />, title: "초고속 스트리밍", desc: "어디서든 끊김 없는 고화질 미디어 재생 환경을 제공합니다." },
            { icon: <Share2 className="text-emerald-400" />, title: "스마트 공유", desc: "가족, 친구와 클릭 한 번으로 안전하게 폴더를 공유하세요." }
          ].map((feature, i) => (
            <div key={i} className="group p-8 rounded-[32px] bg-white/5 border border-white/10 hover:border-purple-500/50 transition-all hover:-translate-y-2">
              <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
              <p className="text-white/40 leading-relaxed text-sm">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>

        {/* 하단 시스템 상태 보드 */}
        <div className="relative p-10 rounded-[40px] bg-gradient-to-b from-white/10 to-transparent border border-white/10 overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Globe size={120} />
          </div>
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-8">
              <CheckCircle2 className="text-emerald-400" />
              <h3 className="text-xl font-bold italic tracking-tight">SYSTEM OPERATIONAL</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <StatusItem label="Platform" value="Next.js 14" />
              <StatusItem label="Database" value="PostgreSQL" />
              <StatusItem label="Security" value="AES-256" />
              <StatusItem label="Auth" value="NextAuth.js" />
            </div>
          </div>
        </div>
        
        <footer className="mt-24 text-center text-white/20 text-xs font-medium tracking-widest uppercase">
          &copy; 2026 EUM PERSONAL CLOUD SERVICE. ALL RIGHTS RESERVED.
        </footer>
      </div>
    </div>
  );
}

function StatusItem({ label, value }: { label: string, value: string }) {
  return (
    <div>
      <p className="text-white/30 text-[10px] font-bold uppercase tracking-widest mb-1">{label}</p>
      <p className="text-white font-mono text-sm">{value}</p>
    </div>
  );
}