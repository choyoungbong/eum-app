// src/app/api/notifications/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // ✅ 수정: @/app/api/auth/[...nextauth]/route → @/lib/auth (다른 route 파일과 동일하게)
import { prisma } from "@/lib/db";

// PATCH /api/notifications/[id] — 단건 읽음 처리
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // ✅ 수정: Next.js 15 params는 Promise
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!notification) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다" }, { status: 404 });
    }

    // 이미 읽은 경우 DB 업데이트 생략
    if (notification.isRead) {
      return NextResponse.json(notification);
    }

    const updated = await prisma.notification.update({
      where: { id },
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
  { params }: { params: Promise<{ id: string }> } // ✅ 수정: Next.js 15 params는 Promise
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const notification = await prisma.notification.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!notification) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다" }, { status: 404 });
    }

    await prisma.notification.delete({ where: { id } });

    return NextResponse.json({ message: "알림을 삭제했습니다" });
  } catch (error) {
    console.error("DELETE /api/notifications/[id] error:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다" }, { status: 500 });
  }
}
