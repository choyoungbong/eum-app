// src/app/api/files/route.ts
// ⚠️ 수정사항:
// 1. myFilesWhere에 deletedAt: null 추가 (휴지통 파일 노출 방지)
// 2. pinned=true 쿼리파라미터 지원 추가 (PinnedFilesSection용)

export const dynamic = "force-dynamic";

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
    const page      = parseInt(searchParams.get("page")      || "1");
    const limit     = parseInt(searchParams.get("limit")     || "20");
    const sortBy    = searchParams.get("sortBy")    || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
    const folderId  = searchParams.get("folderId");
    const search    = searchParams.get("search")    || "";
    const fileType  = searchParams.get("fileType")  || "";
    const startDate = searchParams.get("startDate");
    const endDate   = searchParams.get("endDate");
    const filter    = searchParams.get("filter")    || "all";
    // ✅ 추가: 고정 파일 전용 필터
    const pinnedOnly = searchParams.get("pinned") === "true";

    const skip = (page - 1) * limit;

    // ✅ 수정: deletedAt: null 추가
    const myFilesWhere: any = {
      userId:    session.user.id,
      deletedAt: null,
    };

    // 고정 파일만 조회
    if (pinnedOnly) {
      myFilesWhere.isPinned = true;
      const files = await prisma.file.findMany({
        where:   myFilesWhere,
        orderBy: { updatedAt: "desc" },
        take:    limit,
        select: {
          id: true, originalName: true, mimeType: true,
          size: true, thumbnailUrl: true, createdAt: true,
          isStarred: true, isPinned: true,
        },
      });
      return NextResponse.json({ files: files.map((f: any) => ({ ...f, size: f.size.toString() })) });
    }

    if (folderId === "null" || !folderId) {
      myFilesWhere.folderId = null;
    } else {
      myFilesWhere.folderId = folderId;
    }

    if (search) {
      myFilesWhere.OR = [
        { originalName: { contains: search, mode: "insensitive" } },
        { filename:     { contains: search, mode: "insensitive" } },
      ];
    }

    if (fileType === "image") {
      myFilesWhere.mimeType = { startsWith: "image/" };
    } else if (fileType === "video") {
      myFilesWhere.mimeType = { startsWith: "video/" };
    } else if (fileType === "document") {
      myFilesWhere.OR = [
        { mimeType: { contains: "pdf" } },
        { mimeType: { contains: "document" } },
        { mimeType: { contains: "word" } },
      ];
    }

    if (startDate || endDate) {
      myFilesWhere.createdAt = {};
      if (startDate) myFilesWhere.createdAt.gte = new Date(startDate);
      if (endDate)   myFilesWhere.createdAt.lte = new Date(endDate);
    }

    const sharedResources = await prisma.sharedResource.findMany({
      where: { resourceType: "FILE", sharedWithId: session.user.id },
    });
    const sharedFileIds = sharedResources.map((sr: any) => sr.resourceId);

    const sharedFilesData = sharedFileIds.length > 0
      ? await prisma.file.findMany({
          where:   { id: { in: sharedFileIds }, deletedAt: null },
          include: { user: { select: { id: true, name: true, email: true } }, fileTags: { include: { tag: true } } },
        })
      : [];

    const sharedFilesWithMeta = sharedFilesData.map((file: any) => {
      const shareInfo = sharedResources.find((sr: any) => sr.resourceId === file.id);
      return {
        ...file, size: file.size.toString(),
        isShared: true, isOwner: false,
        sharedBy: file.user?.name, sharedByEmail: file.user?.email,
        sharedAt: shareInfo?.createdAt, permission: shareInfo?.permission,
      };
    });

    let myFiles:      any[] = [];
    let totalMyFiles  = 0;

    if (filter === "all" || filter === "mine") {
      [myFiles, totalMyFiles] = await Promise.all([
        prisma.file.findMany({
          where:   myFilesWhere,
          orderBy: { [sortBy]: sortOrder },
          skip:    filter === "mine" ? skip : undefined,
          take:    filter === "mine" ? limit : undefined,
          include: { fileTags: { include: { tag: true } } },
        }),
        prisma.file.count({ where: myFilesWhere }),
      ]);
    }

    const myFilesWithMeta = myFiles.map((file) => ({
      ...file, size: file.size.toString(), isShared: false, isOwner: true,
    }));

    let resultFiles: any[] = [];
    let finalTotal = 0;

    if (filter === "all") {
      const combined = [...myFilesWithMeta, ...sharedFilesWithMeta];
      combined.sort((a, b) => {
        const aVal = (a as any)[sortBy], bVal = (b as any)[sortBy];
        return sortOrder === "desc" ? (aVal > bVal ? -1 : 1) : (aVal > bVal ? 1 : -1);
      });
      finalTotal  = combined.length;
      resultFiles = combined.slice(skip, skip + limit);
    } else if (filter === "mine") {
      resultFiles = myFilesWithMeta;
      finalTotal  = totalMyFiles;
    } else {
      sharedFilesWithMeta.sort((a: any, b: any) => {
        const aVal = (a as any)[sortBy], bVal = (b as any)[sortBy];
        return sortOrder === "desc" ? (aVal > bVal ? -1 : 1) : (aVal > bVal ? 1 : -1);
      });
      finalTotal  = sharedFilesWithMeta.length;
      resultFiles = sharedFilesWithMeta.slice(skip, skip + limit);
    }

    return NextResponse.json({
      files: resultFiles,
      pagination: { total: finalTotal, page, limit, totalPages: Math.ceil(finalTotal / limit) },
      stats: { myFiles: totalMyFiles, sharedFiles: sharedFilesWithMeta.length },
    });

  } catch (error) {
    console.error("Files fetch error:", error);
    return NextResponse.json({ error: "파일 목록 조회 중 오류가 발생했습니다" }, { status: 500 });
  }
}
