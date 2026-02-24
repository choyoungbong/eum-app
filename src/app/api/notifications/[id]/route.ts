// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// PATCH /api/notifications/[id] — 단건 읽음 처리
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!notification) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다" }, { status: 404 });
    }

    const updated = await prisma.notification.update({
      where: { id: params.id },
      data: { isRead: true },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("PATCH /api/notifications/[id] error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}

// DELETE /api/notifications/[id] — 단건 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const notification = await prisma.notification.findFirst({
      where: { id: params.id, userId: session.user.id },
    });
    if (!notification) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다" }, { status: 404 });
    }

    await prisma.notification.delete({ where: { id: params.id } });

    return NextResponse.json({ message: "알림을 삭제했습니다" });
  } catch (error) {
    console.error("DELETE /api/notifications/[id] error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
