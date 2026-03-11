import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

// Portfolio, PortfolioAsset 모델이 없으면 인메모리 대신 Post 메타데이터로 저장
// 아래는 별도 테이블 없이 JSON 파일 방식 대신 Prisma 확장 모델 사용 예시
// 스키마에 아래 모델 추가 필요:
//
// model Portfolio {
//   id        String           @id @default(cuid())
//   userId    String           @map("user_id")
//   name      String
//   createdAt DateTime         @default(now()) @map("created_at")
//   updatedAt DateTime         @updatedAt @map("updated_at")
//   user      User             @relation(fields: [userId], references: [id], onDelete: Cascade)
//   assets    PortfolioAsset[]
//   @@map("portfolios")
// }
//
// model PortfolioAsset {
//   id          String    @id @default(cuid())
//   portfolioId String    @map("portfolio_id")
//   assetType   String    @map("asset_type")  // STOCK_KR | STOCK_US | CRYPTO
//   symbol      String
//   name        String
//   quantity    Float
//   avgPrice    Float     @map("avg_price")
//   createdAt   DateTime  @default(now()) @map("created_at")
//   updatedAt   DateTime  @updatedAt @map("updated_at")
//   portfolio   Portfolio @relation(fields: [portfolioId], references: [id], onDelete: Cascade)
//   @@map("portfolio_assets")
// }

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const portfolios = await (db as any).portfolio.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
    include: { assets: { orderBy: { createdAt: "asc" } } },
  });

  return NextResponse.json({ portfolios });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name } = await req.json();
  if (!name?.trim()) return NextResponse.json({ error: "포트폴리오 이름을 입력하세요" }, { status: 400 });

  const portfolio = await (db as any).portfolio.create({
    data: { name: name.trim(), userId: session.user.id },
  });

  return NextResponse.json(portfolio, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id 필요" }, { status: 400 });

  const portfolio = await (db as any).portfolio.findFirst({
    where: { id, userId: session.user.id },
  });
  if (!portfolio) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await (db as any).portfolio.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
