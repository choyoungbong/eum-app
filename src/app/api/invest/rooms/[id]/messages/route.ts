import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor"); // 마지막 메시지 id (무한스크롤)
  const limit  = 50;

  const messages = await db.chatMessage.findMany({
    where: {
      roomId: params.id,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, content: true, createdAt: true,
      user: { select: { id: true, name: true } },
    },
  });

  return NextResponse.json({
    messages: messages.reverse(),
    hasMore: messages.length === limit,
    nextCursor: messages.length > 0 ? messages[0].id : null,
  });
}
