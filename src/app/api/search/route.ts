export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

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

    // ✅ 페이지네이션 파라미터
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT))));
    const skip = (page - 1) * limit;

    const tagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

    const needsPost = type === "ALL" || type === "POST";
    const needsFile = type === "ALL" || type === "FILE";

    const sharedPostIds = needsPost
      ? await prisma.sharedResource.findMany({
          where: { resourceType: "POST", sharedWithId: session.user.id },
          select: { resourceId: true },
        }).then((rows) => rows.map((r) => r.resourceId))
      : [];

    // ===== where 조건 구성 =====

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

    // ✅ 병렬 실행 + 전체 count도 함께 조회
    const [rawFiles, filesTotalCount, posts, postsTotalCount] = await Promise.all([
      fileWhere
        ? prisma.file.findMany({
            where: fileWhere,
            include: { fileTags: { include: { tag: true } } },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          })
        : Promise.resolve([]),
      fileWhere ? prisma.file.count({ where: fileWhere }) : Promise.resolve(0),
      postWhere
        ? prisma.post.findMany({
            where: postWhere,
            include: {
              user: { select: { id: true, name: true } },
              postTags: { include: { tag: true } },
              _count: { select: { comments: true } },
            },
            orderBy: { createdAt: "desc" },
            skip,
            take: limit,
          })
        : Promise.resolve([]),
      postWhere ? prisma.post.count({ where: postWhere }) : Promise.resolve(0),
    ]);

    const files = rawFiles.map((file) => ({ ...file, size: file.size.toString() }));

    return NextResponse.json({
      files,
      posts,
      // ✅ 페이지네이션 메타데이터
      pagination: {
        page,
        limit,
        filesTotalCount,
        postsTotalCount,
        totalCount: filesTotalCount + postsTotalCount,
        filesTotalPages: Math.ceil(filesTotalCount / limit),
        postsTotalPages: Math.ceil(postsTotalCount / limit),
        hasNextPage:
          page < Math.ceil(filesTotalCount / limit) ||
          page < Math.ceil(postsTotalCount / limit),
      },
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
