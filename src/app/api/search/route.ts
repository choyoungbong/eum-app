export const dynamic = 'force-dynamic';

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

    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q") || "";
    const type = searchParams.get("type") || "ALL";       // ALL | FILE | POST
    const mimeType = searchParams.get("mimeType") || "";   // image | video | pdf | document | zip
    const tagsParam = searchParams.get("tags") || "";       // "tagId1,tagId2"
    const dateFrom = searchParams.get("dateFrom") || "";
    const dateTo = searchParams.get("dateTo") || "";

    const tagIds = tagsParam ? tagsParam.split(",").filter(Boolean) : [];

    let files: any[] = [];
    let posts: any[] = [];

    // ===== 파일 검색 =====
    if (type === "ALL" || type === "FILE") {
      const fileWhere: any = {
        userId: session.user.id,
      };

      // 키워드
      if (q.trim()) {
        fileWhere.originalName = {
          contains: q.trim(),
          mode: "insensitive",
        };
      }

      // MIME 타입 필터
      if (mimeType) {
        const mimeMap: Record<string, any> = {
          image: { startsWith: "image/" },
          video: { startsWith: "video/" },
          pdf: { equals: "application/pdf" },
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
          zip: {
            in: [
              "application/zip",
              "application/x-rar-compressed",
              "application/x-7z-compressed",
            ],
          },
        };

        if (mimeMap[mimeType]) {
          fileWhere.mimeType = mimeMap[mimeType];
        }
      }

      // 날짜 필터
      if (dateFrom || dateTo) {
        fileWhere.createdAt = {};
        if (dateFrom) fileWhere.createdAt.gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          fileWhere.createdAt.lte = to;
        }
      }

      // 태그 필터
      if (tagIds.length > 0) {
        fileWhere.fileTags = {
          some: {
            tagId: { in: tagIds },
          },
        };
      }

      files = await prisma.file.findMany({
        where: fileWhere,
        include: {
          fileTags: {
            include: { tag: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });

      // BigInt 직렬화
      files = files.map(file => ({
        ...file,
        size: file.size.toString(),
      }));
    }

    // ===== 게시글 검색 =====
    if (type === "ALL" || type === "POST") {
      // 먼저 공유받은 게시글 ID 목록 조회
      const sharedPostIds = await prisma.sharedResource.findMany({
        where: {
          resourceType: "POST",
          sharedWithId: session.user.id,
        },
        select: { resourceId: true },
      });

      const postWhere: any = {
        OR: [
          { userId: session.user.id },
          { visibility: "PUBLIC" },
          {
            visibility: "SHARED",
            id: { in: sharedPostIds.map(sr => sr.resourceId) },
          },
        ],
      };

      // 키워드
      if (q.trim()) {
        postWhere.AND = [
          {
            OR: [
              { title: { contains: q.trim(), mode: "insensitive" } },
              { content: { contains: q.trim(), mode: "insensitive" } },
            ],
          },
        ];
      }

      // 날짜 필터
      if (dateFrom || dateTo) {
        const dateFilter: any = {};
        if (dateFrom) dateFilter.gte = new Date(dateFrom);
        if (dateTo) {
          const to = new Date(dateTo);
          to.setHours(23, 59, 59, 999);
          dateFilter.lte = to;
        }

        if (postWhere.AND) {
          postWhere.AND.push({ createdAt: dateFilter });
        } else {
          postWhere.AND = [{ createdAt: dateFilter }];
        }
      }

      // 태그 필터
      if (tagIds.length > 0) {
        const tagFilter = {
          postTags: { some: { tagId: { in: tagIds } } },
        };
        if (postWhere.AND) {
          postWhere.AND.push(tagFilter);
        } else {
          postWhere.AND = [tagFilter];
        }
      }

      posts = await prisma.post.findMany({
        where: postWhere,
        include: {
          user: { select: { id: true, name: true } },
          postTags: { include: { tag: true } },
          _count: { select: { comments: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }

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