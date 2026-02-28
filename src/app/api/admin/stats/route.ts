// src/app/api/admin/stats/route.ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN")
    return NextResponse.json({ error: "관리자 권한이 필요합니다" }, { status: 403 });

  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);

  const [
    totalUsers, activeUsers, bannedUsers,
    totalFiles, totalStorage,
    totalPosts, totalComments,
    newUsersLast30, newFilesLast30,
    storageByUser, filesByType, dailySignups, dailyUploads,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isOnline: true } }),
    prisma.user.count({ where: { isBanned: true } }),
    prisma.file.count({ where: { deletedAt: null } }),
    prisma.file.aggregate({ _sum: { size: true }, where: { deletedAt: null } }),
    prisma.post.count(),
    prisma.comment.count(),
    prisma.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    prisma.file.count({ where: { createdAt: { gte: thirtyDaysAgo }, deletedAt: null } }),
    prisma.file.groupBy({ by: ["userId"], _sum: { size: true }, orderBy: { _sum: { size: "desc" } }, take: 10 }),
    prisma.$queryRaw<{ type: string; count: bigint; size: bigint }[]>`
      SELECT CASE WHEN "mime_type" LIKE 'image/%' THEN '이미지' WHEN "mime_type" LIKE 'video/%' THEN '영상' WHEN "mime_type" LIKE 'audio/%' THEN '오디오' WHEN "mime_type" = 'application/pdf' THEN 'PDF' ELSE '기타' END AS type, COUNT(*) AS count, SUM(size) AS size FROM files WHERE deleted_at IS NULL GROUP BY type ORDER BY count DESC`,
    prisma.$queryRaw<{ date: string; count: bigint }[]>`SELECT DATE("created_at") AS date, COUNT(*) AS count FROM users WHERE "created_at" >= NOW() - INTERVAL '14 days' GROUP BY DATE("created_at") ORDER BY date`,
    prisma.$queryRaw<{ date: string; count: bigint }[]>`SELECT DATE("created_at") AS date, COUNT(*) AS count FROM files WHERE "created_at" >= NOW() - INTERVAL '14 days' AND "deleted_at" IS NULL GROUP BY DATE("created_at") ORDER BY date`,
  ]);

  const userIds = storageByUser.map((x: any) => x.userId);
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } });
  const userMap = Object.fromEntries(users.map((u: any) => [u.id, u]));

  return NextResponse.json({
  summary: { 
    totalUsers, activeUsers, bannedUsers, totalFiles, 
    totalStorage: totalStorage._sum.size?.toString() ?? "0", 
    totalPosts, totalComments, newUsersLast30, newFilesLast30 
  },
  // (x)를 (x: any)로 수정하여 타입을 명시합니다.
  topStorageUsers: storageByUser.map((x: any) => ({ 
    ...userMap[x.userId], 
    storageUsed: x._sum.size?.toString() ?? "0" 
  })),
  filesByType: filesByType.map((x: any) => ({ 
    type: x.type, 
    count: Number(x.count), 
    size: x.size.toString() 
  })),
  dailySignups: dailySignups.map((x: any) => ({ 
    date: x.date, 
    count: Number(x.count) 
  })),
  dailyUploads: dailyUploads.map((x: any) => ({ 
    date: x.date, 
    count: Number(x.count) 
  })),
});
}
