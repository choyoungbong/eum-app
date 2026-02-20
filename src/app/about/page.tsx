"use client";

import Link from "next/link";
import { 
  Cpu, 
  Database, 
  Layers, 
  ShieldCheck, 
  Smartphone, 
  Zap, 
  ArrowLeft,
  Server,
  Code2
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-[#0f0c29] text-white selection:bg-purple-500/30">
      {/* 상단 장식 블러 */}
      <div className="fixed top-0 right-0 w-[300px] h-[300px] bg-blue-600/10 blur-[100px] -z-10" />

      <div className="max-w-4xl mx-auto px-6 py-16">
        {/* 뒤로가기 & 헤더 */}
        <Link href="/" className="inline-flex items-center gap-2 text-white/40 hover:text-white transition-colors mb-12 group">
          <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          <span>메인으로 돌아가기</span>
        </Link>

        <section className="mb-20">
          <h1 className="text-4xl md:text-5xl font-black mb-6 tracking-tight">
            기술로 잇는 <br />
            <span className="text-purple-400">나만의 디지털 생태계</span>
          </h1>
          <p className="text-lg text-white/60 leading-relaxed">
            EUM(이음)은 단순한 저장소를 넘어, 사용자의 모든 기기와 데이터를 <br className="hidden md:block" />
            가장 빠르고 안전한 방식으로 연결하기 위해 설계되었습니다.
          </p>
        </section>

        {/* 핵심 기술 스택 섹션 */}
        <div className="grid gap-12 mb-24">
          <FeatureRow 
            icon={<Cpu size={32} />}
            title="고성능 하이브리드 아키텍처"
            desc="Next.js 14의 Server Actions와 API Routes를 적재적소에 배치하여, 대용량 파일 업로드 시에도 브라우저 부하를 최소화하고 서버 자원을 효율적으로 관리합니다."
          />
          <FeatureRow 
            icon={<ShieldCheck size={32} />}
            title="엔터프라이즈급 보안 시스템"
            desc="사용자의 비밀번호는 Argon2 알고리즘으로 해싱되며, 모든 데이터 전송은 SSL/TLS 암호화 레이어를 통과합니다. 데이터베이스 수준에서의 접근 제어로 보안 사고를 원천 봉쇄합니다."
          />
          <FeatureRow 
            icon={<Zap size={32} />}
            title="실시간 데이터 동기화"
            desc="Socket.io와 Prisma의 실시간 이벤트를 결합하여, 파일 업로드나 채팅 메시지 전송 즉시 모든 연결된 기기에 상태가 반영됩니다."
          />
        </div>

        {/* 기술 스택 그리드 */}
        <div className="bg-white/5 border border-white/10 rounded-[32px] p-10">
          <h3 className="text-xl font-bold mb-8 flex items-center gap-2">
            <Code2 className="text-purple-400" />
            Built with Modern Stack
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <StackItem icon={<Layers className="text-blue-400" />} name="Next.js 14" detail="App Router" />
            <StackItem icon={<Database className="text-emerald-400" />} name="PostgreSQL" detail="Prisma ORM" />
            <StackItem icon={<Server className="text-orange-400" />} name="Node.js" detail="Runtime" />
            <StackItem icon={<Smartphone className="text-pink-400" />} name="Firebase" detail="FCM Push" />
          </div>
        </div>

        {/* CTA */}
        <div className="mt-24 text-center">
          <p className="text-white/40 mb-6">준비가 되셨나요?</p>
          <Link
            href="/signup"
            className="inline-flex px-10 py-4 bg-gradient-to-r from-purple-500 to-blue-600 text-white font-black rounded-2xl hover:scale-105 transition-all shadow-xl shadow-purple-500/20"
          >
            지금 바로 계정 만들기
          </Link>
        </div>
      </div>
    </div>
  );
}

function FeatureRow({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex flex-col md:flex-row gap-6 items-start">
      <div className="w-16 h-16 shrink-0 rounded-2xl bg-white/5 flex items-center justify-center text-purple-400 border border-white/10">
        {icon}
      </div>
      <div>
        <h3 className="text-2xl font-bold mb-3">{title}</h3>
        <p className="text-white/50 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function StackItem({ icon, name, detail }: { icon: React.ReactNode, name: string, detail: string }) {
  return (
    <div className="text-center md:text-left">
      <div className="mb-3 flex justify-center md:justify-start">{icon}</div>
      <p className="font-bold text-sm">{name}</p>
      <p className="text-white/30 text-xs">{detail}</p>
    </div>
  );
}