// src/app/api/users/me/export/route.ts
// GET /api/users/me/export?format=json
// 사용자 본인의 모든 데이터를 JSON으로 내보냅니다 (GDPR 대응)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const userId = session.user.id;

    // 모든 데이터 병렬 조회
    const [user, files, folders, posts, comments, notifications, activityLogs] =
      await Promise.all([
        prisma.user.findUnique({
          where: { id: userId },
          select: {
            id: true, name: true, email: true, role: true,
            emailVerified: true, createdAt: true, updatedAt: true,
            isOnline: true, lastSeenAt: true,
          },
        }),
        prisma.file.findMany({
          where: { userId },
          select: {
            id: true, originalName: true, mimeType: true,
            size: true, createdAt: true, folderId: true,
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.folder.findMany({
          where: { userId },
          select: { id: true, name: true, parentId: true, createdAt: true },
        }),
        prisma.post.findMany({
          where: { userId },
          select: {
            id: true, title: true, content: true,
            visibility: true, createdAt: true,
            comments: { select: { id: true, content: true, createdAt: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.comment.findMany({
          where: { userId },
          select: {
            id: true, content: true, createdAt: true,
            post: { select: { id: true, title: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.notification.findMany({
          where: { userId },
          select: { id: true, type: true, title: true, body: true, isRead: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 200,
        }),
        prisma.activityLog.findMany({
          where: { userId },
          select: { id: true, action: true, target: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 500,
        }).catch(() => []), // ActivityLog 테이블 없으면 빈 배열
      ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportVersion: "1.0",
      user,
      summary: {
        fileCount: files.length,
        folderCount: folders.length,
        postCount: posts.length,
        commentCount: comments.length,
        notificationCount: notifications.length,
        activityLogCount: activityLogs.length,
      },
      files,
      folders,
      posts,
      comments,
      notifications,
      activityLogs,
    };

    const filename = `eum-data-export-${new Date().toISOString().split("T")[0]}.json`;

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/users/me/export error:", error);
    return NextResponse.json({ error: "내보내기 중 오류가 발생했습니다" }, { status: 500 });
  }
}
