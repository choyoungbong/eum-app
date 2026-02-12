import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 온라인 상태 업데이트
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
    const { isOnline, networkType } = body;

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        isOnline: isOnline !== undefined ? isOnline : true,
        lastSeenAt: new Date(),
        networkType: networkType || "WIFI",
      },
    });

    return NextResponse.json({
      message: "온라인 상태가 업데이트되었습니다",
    });
  } catch (error) {
    console.error("Presence update error:", error);
    return NextResponse.json(
      { error: "상태 업데이트 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
