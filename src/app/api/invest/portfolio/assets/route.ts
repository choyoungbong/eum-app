import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { portfolioId, assetType, symbol, name, quantity, avgPrice } = await req.json();
  if (!portfolioId || !symbol || !name || !quantity || !avgPrice) {
    return NextResponse.json({ error: "필수 항목을 입력하세요" }, { status: 400 });
  }

  // 본인 포트폴리오인지 확인
  const portfolio = await (db as any).portfolio.findFirst({
    where: { id: portfolioId, userId: session.user.id },
  });
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 같은 심볼이 있으면 평균단가 재계산 후 업데이트
  const existing = await (db as any).portfolioAsset.findFirst({
    where: { portfolioId, symbol },
  });

  if (existing) {
    const totalQty  = existing.quantity + Number(quantity);
    const newAvg    = (existing.avgPrice * existing.quantity + Number(avgPrice) * Number(quantity)) / totalQty;
    const updated   = await (db as any).portfolioAsset.update({
      where: { id: existing.id },
      data: { quantity: totalQty, avgPrice: newAvg },
    });
    return NextResponse.json(updated);
  }

  const asset = await (db as any).portfolioAsset.create({
    data: { portfolioId, assetType, symbol, name, quantity: Number(quantity), avgPrice: Number(avgPrice) },
  });
  return NextResponse.json(asset, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const asset = await (db as any).portfolioAsset.findFirst({
    where: { id },
    include: { portfolio: true },
  });
  if (!asset || asset.portfolio.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await (db as any).portfolioAsset.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
