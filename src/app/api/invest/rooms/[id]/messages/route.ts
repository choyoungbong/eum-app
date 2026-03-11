import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma as db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cursor = searchParams.get("cursor");
  const limit  = 50;

  const messages = await db.chatMessage.findMany({
    where: {
      chatRoomId: params.id,
      ...(cursor ? { id: { lt: cursor } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true, content: true, createdAt: true, type: true,
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  });

  return NextResponse.json({
    messages: messages.reverse(),
    hasMore: messages.length === limit,
    nextCursor: messages.length > 0 ? messages[0].id : null,
  });
}