// src/lib/optimized-queries.ts
import { prisma } from "@/lib/db";
import { withCache, TTL } from "@/lib/cache";

export async function getFileList(userId: string, folderId: string | null = null, page = 1, limit = 20) {
  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where: { userId, folderId, deletedAt: null },
      select: { id: true, originalName: true, mimeType: true, size: true, thumbnailUrl: true, createdAt: true, isEncrypted: true, publicToken: true, isStarred: true, isPinned: true, _count: { select: { fileTags: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit, take: limit,
    }),
    prisma.file.count({ where: { userId, folderId, deletedAt: null } }),
  ]);
  return { files, total, hasMore: page * limit < total };
}

export async function getPinnedFiles(userId: string) {
  return prisma.file.findMany({
    where: { userId, isPinned: true, deletedAt: null },
    select: { id: true, originalName: true, mimeType: true, size: true, thumbnailUrl: true },
    orderBy: { updatedAt: "desc" }, take: 10,
  });
}

export async function getPostList(viewerId: string, page = 1, limit = 20) {
  const [posts, total] = await Promise.all([
    prisma.post.findMany({
      where: { visibility: { in: ["PUBLIC", "SHARED"] } },
      select: {
        id: true, title: true, content: true, createdAt: true,
        user: { select: { id: true, name: true } },
        _count: { select: { comments: true, likes: true } },
        likes:     { where: { userId: viewerId }, select: { id: true } },
        bookmarks: { where: { userId: viewerId }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit,
    }),
    prisma.post.count({ where: { visibility: { in: ["PUBLIC", "SHARED"] } } }),
  ]);
  return {
    posts: posts.map((p) => ({ ...p, liked: p.likes.length > 0, bookmarked: p.bookmarks.length > 0, likes: undefined, bookmarks: undefined })),
    total, hasMore: page * limit < total,
  };
}

// ⚠️ Notification 스키마: title/body (message 필드 없음)
export async function getNotifications(userId: string, limit = 20) {
  return withCache(`notifications:${userId}:${limit}`,
    () => prisma.notification.findMany({
      where: { userId }, orderBy: { createdAt: "desc" }, take: limit,
      select: { id: true, type: true, title: true, body: true, link: true, isRead: true, createdAt: true },
    }),
    TTL.SHORT, [`user:${userId}:notifications`]
  );
}

export async function globalSearch(userId: string, q: string, limit = 30) {
  if (!q.trim()) return { files: [], posts: [], users: [] };
  const chunk = Math.floor(limit / 3);
  const [files, posts, users] = await Promise.all([
    prisma.file.findMany({ where: { userId, deletedAt: null, originalName: { contains: q, mode: "insensitive" } }, select: { id: true, originalName: true, mimeType: true, size: true, thumbnailUrl: true }, take: chunk }),
    prisma.post.findMany({ where: { visibility: { in: ["PUBLIC", "SHARED"] }, OR: [{ title: { contains: q, mode: "insensitive" } }, { content: { contains: q, mode: "insensitive" } }] }, select: { id: true, title: true, content: true, user: { select: { id: true, name: true } } }, take: chunk }),
    prisma.user.findMany({ where: { id: { not: userId }, name: { contains: q, mode: "insensitive" } }, select: { id: true, name: true, isOnline: true }, take: chunk }),
  ]);
  return { files, posts, users };
}

export async function getAdminStats() {
  return withCache("admin:stats:summary", async () => {
    const [totalUsers, totalFiles, storage] = await Promise.all([
      prisma.user.count(),
      prisma.file.count({ where: { deletedAt: null } }),
      prisma.file.aggregate({ _sum: { size: true }, where: { deletedAt: null } }),
    ]);
    return { totalUsers, totalFiles, totalStorage: storage._sum.size?.toString() ?? "0" };
  }, TTL.LONG, ["admin-stats"]);
}
