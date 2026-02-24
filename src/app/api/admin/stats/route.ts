// src/app/api/admin/stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });
  }

  const [totalUsers, onlineUsers, adminCount, totalFiles, totalPosts, totalComments] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isOnline: true } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.file.count(),
      prisma.post.count(),
      prisma.comment.count(),
    ]);

  return NextResponse.json({
    totalUsers,
    onlineUsers,
    adminCount,
    totalFiles,
    totalPosts,
    totalComments,
  });
}
