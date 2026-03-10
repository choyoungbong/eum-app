export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "ALL";
    const mimeType = searchParams.get("mimeType") || "";
    const tagsParam = searchParams.get("tags") || "";
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    const tagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

    // ✅ [성능] 파일/게시글 모두 필요한 경우 sharedPostIds를 먼저 1회만 조회
    const needsPost = type === "ALL" || type === "POST";
    const needsFile = type === "ALL" || type === "FILE";

    const sharedPostIds = needsPost
      ? await prisma.sharedResource.findMany({
          where: { resourceType: "POST", sharedWithId: session.user.id },
          select: { resourceId: true },
        }).then((rows) => rows.map((r) => r.resourceId))
      : [];

    // ===== where 조건 구성 (쿼리 실행 전) =====

    // 파일 where
    const fileWhere: any = needsFile ? { userId: session.user.id } : null;

    if (fileWhere) {
      if (q.trim()) {
        fileWhere.originalName = { contains: q.trim(), mode: "insensitive" };
      }

      if (mimeType) {
        const mimeMap: Record<string, any> = {
          image:    { startsWith: "image/" },
          video:    { startsWith: "video/" },
          pdf:      { equals: "application/pdf" },
          document: {
            in: [
              "application/msword",
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
              "application/vnd.ms-excel",
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              "application/vnd.ms-powerpoint",
              "application/vnd.openxmlformats-officedocument.presentationml.presentation",
              "text/plain",
            ],
          },
          zip: { in: ["application/zip", "application/x-rar-compressed", "application/x-7z-compressed"] },
        };
        if (mimeMap[mimeType]) fileWhere.mimeType = mimeMap[mimeType];
      }

      if (dateFrom || dateTo) {
        fileWhere.createdAt = {};
        if (dateFrom) fileWhere.createdAt.gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          fileWhere.createdAt.lte = to;
        }
      }

      if (tagIds.length > 0) {
        fileWhere.fileTags = { some: { tagId: { in: tagIds } } };
      }
    }

    // 게시글 where
    const postWhere: any = needsPost
      ? {
          OR: [
            { userId: session.user.id },
            { visibility: "PUBLIC" },
            { visibility: "SHARED", id: { in: sharedPostIds } },
          ],
        }
      : null;

    if (postWhere) {
      const andClauses: any[] = [];

      if (q.trim()) {
        andClauses.push({
          OR: [
            { title: { contains: q.trim(), mode: "insensitive" } },
            { content: { contains: q.trim(), mode: "insensitive" } },
          ],
        });
      }

      if (dateFrom || dateTo) {
        const dateFilter: any = {};
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          dateFilter.lte = to;
        }
        andClauses.push({ createdAt: dateFilter });
      }

      if (tagIds.length > 0) {
        andClauses.push({ postTags: { some: { tagId: { in: tagIds } } } });
      }

      if (andClauses.length > 0) postWhere.AND = andClauses;
    }

    // ✅ [성능] 파일 검색 + 게시글 검색 병렬 실행
    const [rawFiles, posts] = await Promise.all([
      fileWhere
        ? prisma.file.findMany({
            where: fileWhere,
            include: { fileTags: { include: { tag: true } } },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
      postWhere
        ? prisma.post.findMany({
            where: postWhere,
            include: {
              user: { select: { id: true, name: true } },
              postTags: { include: { tag: true } },
              _count: { select: { comments: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
          })
        : Promise.resolve([]),
    ]);

    // BigInt 직렬화
    const files = rawFiles.map((file) => ({ ...file, size: file.size.toString() }));

    return NextResponse.json({
      files,
      posts,
      total: files.length + posts.length,
      query: q,
      filters: { type, mimeType, tagIds, dateFrom, dateTo },
    });

  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "검색 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
