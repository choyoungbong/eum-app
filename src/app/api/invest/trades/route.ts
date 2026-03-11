import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const limit  = parseInt(searchParams.get("limit") ?? "50");

  const trades = await (db as any).trade.findMany({
    where: { userId: session.user.id, ...(symbol ? { symbol } : {}) },
    orderBy: { tradedAt: "desc" },
    take: limit,
  });

  // 실현 손익 계산 (심볼별)
  const stats = trades.reduce((acc: any, t: any) => {
    if (!acc[t.symbol]) acc[t.symbol] = { totalBuy: 0, totalSell: 0, buyQty: 0 };
    if (t.side === "BUY") {
      acc[t.symbol].totalBuy += t.price * t.quantity + t.fee;
      acc[t.symbol].buyQty  += t.quantity;
    } else {
      acc[t.symbol].totalSell += t.price * t.quantity - t.fee;
    }
    return acc;
  }, {} as Record<string, { totalBuy: number; totalSell: number; buyQty: number }>);

  return NextResponse.json({ trades, stats });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { assetType, symbol, name, side, quantity, price, fee, memo, tradedAt, portfolioId } = await req.json();

  if (!symbol || !name || !side || !quantity || !price) {
    return NextResponse.json({ error: "필수 항목 누락" }, { status: 400 });
  }

  const trade = await (db as any).trade.create({
    data: {
      userId: session.user.id,
      portfolioId: portfolioId ?? null,
      assetType, symbol, name, side,
      quantity: Number(quantity),
      price:    Number(price),
      fee:      Number(fee ?? 0),
      memo:     memo ?? null,
      tradedAt: tradedAt ? new Date(tradedAt) : new Date(),
    },
  });

  return NextResponse.json(trade, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const trade = await (db as any).trade.findFirst({ where: { id, userId: session.user.id } });
  if (!trade) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (db as any).trade.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
