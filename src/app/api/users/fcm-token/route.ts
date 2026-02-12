import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// FCM 토큰 등록
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { fcmToken } = body;

    if (!fcmToken) {
      return NextResponse.json(
        { error: "FCM 토큰을 제공하세요" },
        { status: 400 }
      );
    }

    // 토큰 저장
    await prisma.user.update({
      where: { id: session.user.id },
      data: { fcmToken },
    });

    return NextResponse.json({
      message: "FCM 토큰이 등록되었습니다",
    });
  } catch (error) {
    console.error("FCM token registration error:", error);
    return NextResponse.json(
      { error: "토큰 등록 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// FCM 토큰 삭제 (로그아웃 시)
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { fcmToken: null },
    });

    return NextResponse.json({
      message: "FCM 토큰이 삭제되었습니다",
    });
  } catch (error) {
    console.error("FCM token deletion error:", error);
    return NextResponse.json(
      { error: "토큰 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}