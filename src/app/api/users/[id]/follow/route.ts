import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const targetUserId = params.id;

    if (session.user.id === targetUserId) {
      return NextResponse.json(
        { error: "자기 자신은 팔로우할 수 없습니다." },
        { status: 400 }
      );
    }

    // 팔로우 생성
    await prisma.follow.create({
      data: {
        followerId: session.user.id,
        followingId: targetUserId,
      },
    });

    // 🔥 알림 생성 (message 필수 추가)
    await prisma.notification.create({
      data: {
        user: {
          connect: { id: targetUserId },
        },
        type: "SYSTEM",
        title: `${session.user.name}님이 팔로우했습니다`,
        message: `${session.user.name}님이 당신을 팔로우했습니다.`, // ✅ 추가
        link: `/users/${session.user.id}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Follow error:", error);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}