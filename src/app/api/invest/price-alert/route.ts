import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";
import { sendPushToUser } from "@/lib/fcm";

// 목표가 체크 — cron 또는 수동 트리거
// GET /api/invest/price-alert  → 전체 watchlist 목표가 체크
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const watchlist = await (db as any).watchlist.findMany({
    where: { userId: session.user.id, targetPrice: { not: null } },
  });

  if (watchlist.length === 0) return NextResponse.json({ checked: 0, triggered: [] });

  // 현재가 조회 (보유 자산 유형별 API 호출)
  const [krStocks, usStocks, crypto] = await Promise.allSettled([
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/invest/stocks`).then((r) => r.json()),
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/invest/us-stocks`).then((r) => r.json()),
    fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/invest/crypto`).then((r) => r.json()),
  ]);

  const priceMap: Record<string, number> = {};
  if (krStocks.status === "fulfilled") (krStocks.value.stocks ?? []).forEach((s: any) => { priceMap[s.symbol.replace(".KS","").replace(".KQ","")] = s.price; });
  if (usStocks.status === "fulfilled") (usStocks.value.stocks ?? []).forEach((s: any) => { priceMap[s.symbol] = s.price; });
  if (crypto.status   === "fulfilled") (crypto.value.coins   ?? []).forEach((c: any) => { priceMap[c.symbol] = c.price; });

  const triggered: string[] = [];

  for (const item of watchlist) {
    const key  = item.symbol.replace(".KS","").replace(".KQ","");
    const cur  = priceMap[key];
    if (!cur || !item.targetPrice) continue;

    const reached = cur >= item.targetPrice;
    if (reached) {
      triggered.push(item.symbol);
      // FCM 푸시 발송
      try {
        await sendPushToUser(session.user.id, {
          title: `📈 목표가 도달! ${item.name}`,
          body:  `현재가 ${cur.toLocaleString()}원 / 목표가 ${item.targetPrice.toLocaleString()}원`,
          data:  { type: "PRICE_ALERT", symbol: item.symbol, url: "/invest" },
        });
      } catch (e) {
        console.error("FCM push failed:", e);
      }
    }
  }

  return NextResponse.json({ checked: watchlist.length, triggered });
}
