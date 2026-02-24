import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import bcrypt from "bcryptjs";

// GET /api/users/me — 현재 사용자 정보 + 스토리지 통계
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        emailVerified: true,
        createdAt: true,
        isOnline: true,
        _count: {
          select: {
            files: true,
            posts: true,
            comments: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    }

    // 스토리지 합계 계산
    const storageAgg = await prisma.file.aggregate({
      where: { userId: session.user.id },
      _sum: { size: true },
    });

    const totalBytes = Number(storageAgg._sum.size ?? 0);

    return NextResponse.json({
      user,
      stats: {
        totalFiles: user._count.files,
        totalPosts: user._count.posts,
        totalComments: user._count.comments,
        storageUsedBytes: totalBytes,
        storageUsedMB: (totalBytes / 1024 / 1024).toFixed(2),
      },
    });
  } catch (error) {
    console.error("GET /api/users/me error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}

// PATCH /api/users/me — 이름 변경 또는 비밀번호 변경
export async function PATCH(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { name, currentPassword, newPassword } = body;

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다" }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // 이름 변경
    if (name !== undefined) {
      const trimmed = name.trim();
      if (!trimmed) {
        return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });
      }
      if (trimmed.length > 20) {
        return NextResponse.json({ error: "이름은 20자 이하여야 합니다" }, { status: 400 });
      }
      updateData.name = trimmed;
    }

    // 비밀번호 변경
    if (newPassword !== undefined) {
      if (!currentPassword) {
        return NextResponse.json({ error: "현재 비밀번호를 입력해주세요" }, { status: 400 });
      }
      const valid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "현재 비밀번호가 올바르지 않습니다" }, { status: 400 });
      }
      if (newPassword.length < 8) {
        return NextResponse.json({ error: "새 비밀번호는 8자 이상이어야 합니다" }, { status: 400 });
      }
      updateData.passwordHash = await bcrypt.hash(newPassword, 12);
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "변경할 정보가 없습니다" }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: updateData,
      select: { id: true, name: true, email: true },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    console.error("PATCH /api/users/me error:", error);
    return NextResponse.json({ error: "서버 오류" }, { status: 500 });
  }
}
