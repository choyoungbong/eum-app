"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2, Star, Wallet, Receipt, Newspaper, MessageSquare,
} from "lucide-react";

const TABS = [
  { href: "/invest",           label: "시세",     icon: BarChart2     },
  { href: "/invest/watchlist", label: "관심",     icon: Star          },
  { href: "/invest/portfolio", label: "포트폴리오", icon: Wallet       },
  { href: "/invest/trades",    label: "거래",     icon: Receipt       },
  { href: "/invest/community", label: "커뮤니티", icon: MessageSquare },
];

export default function InvestNav() {
  const path = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-zinc-950/90 backdrop-blur-xl border-t border-white/5 safe-area-pb">
      <div className="max-w-3xl mx-auto flex">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = path === href || (href !== "/invest" && path.startsWith(href));
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 transition-all ${
                active ? "text-violet-400" : "text-zinc-600 hover:text-zinc-400"
              }`}>
              <Icon size={18} strokeWidth={active ? 2.5 : 1.8} />
              <span className="text-[9px] font-medium">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
