import { NextResponse } from "next/server";

const LABELS: Record<string, { ko: string; color: string }> = {
  "Extreme Fear":  { ko: "극단적 공포", color: "#ef4444" },
  "Fear":          { ko: "공포",         color: "#f97316" },
  "Neutral":       { ko: "중립",         color: "#eab308" },
  "Greed":         { ko: "탐욕",         color: "#84cc16" },
  "Extreme Greed": { ko: "극단적 탐욕", color: "#22c55e" },
};

export async function GET() {
  try {
    const res = await fetch("https://api.alternative.me/fng/?limit=30", {
      next: { revalidate: 3600 }, // 1시간 캐시 (하루 1회 업데이트)
    });
    if (!res.ok) throw new Error("Fear & Greed API 실패");
    const data = await res.json();

    const list: any[] = data.data ?? [];

    const latest = list[0];
    const yesterday = list[1];
    const weekAgo = list[6];
    const monthAgo = list[29];

    const format = (item: any) => ({
      value: Number(item.value),
      label: item.value_classification,
      labelKo: LABELS[item.value_classification]?.ko ?? item.value_classification,
      color: LABELS[item.value_classification]?.color ?? "#71717a",
      timestamp: item.timestamp,
      date: new Date(Number(item.timestamp) * 1000).toLocaleDateString("ko-KR"),
    });

    // 최근 30일 히스토리 (차트용)
    const history = list.slice(0, 30).map(format).reverse();

    return NextResponse.json({
      current: format(latest),
      comparison: {
        yesterday: yesterday ? format(yesterday) : null,
        weekAgo:   weekAgo   ? format(weekAgo)   : null,
        monthAgo:  monthAgo  ? format(monthAgo)  : null,
      },
      history,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "공포탐욕지수 조회 실패" }, { status: 500 });
  }
}
