export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";
    
    // [추가] 폴더 격리 핵심 파라미터
    const folderId = searchParams.get("folderId"); // "null" 또는 "uuid"

    // 검색 & 필터
    const search = searchParams.get("search") || "";
    const fileType = searchParams.get("fileType") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const filter = searchParams.get("filter") || "all"; // all, mine, shared

    const skip = (page - 1) * limit;

    /**
     * ==========================================
     * 1. 내 파일 조건 설정 (folderId 필터링 추가)
     * ==========================================
     */
    const myFilesWhere: any = {
      userId: session.user.id,
    };

    // [핵심 수정] 폴더 격리 로직 주입
    // folderId가 "null" 문자열로 오면 부모가 없는(홈) 파일만, ID가 오면 해당 폴더 파일만.
    if (folderId === "null" || !folderId) {
      myFilesWhere.folderId = null;
    } else {
      myFilesWhere.folderId = folderId;
    }

    // 검색어 필터
    if (search) {
      myFilesWhere.OR = [
        { originalName: { contains: search, mode: "insensitive" } },
        { filename: { contains: search, mode: "insensitive" } },
      ];
    }

    // 파일 타입 필터
    if (fileType) {
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
    }

    // 날짜 범위 필터
    if (startDate || endDate) {
      myFilesWhere.createdAt = {};
      if (startDate) myFilesWhere.createdAt.gte = new Date(startDate);
      if (endDate) myFilesWhere.createdAt.lte = new Date(endDate);
    }

    /**
     * ==========================================
     * 2. 공유받은 파일 조회 (공유는 폴더 격리에서 제외하거나 별도 처리)
     * ==========================================
     */
    const sharedResources = await prisma.sharedResource.findMany({
      where: {
        resourceType: "FILE",
        sharedWithId: session.user.id,
      },
    });

    const sharedFileIds = sharedResources.map((sr) => sr.resourceId);

    // 공유받은 파일 상세 정보 (공유받은 파일은 폴더 경로와 상관없이 보여주는 것이 일반적)
    const sharedFilesData = sharedFileIds.length > 0 
      ? await prisma.file.findMany({
          where: { id: { in: sharedFileIds } },
          include: { 
            user: { 
              select: { id: true, name: true, email: true } 
            },
            fileTags: {
              include: { tag: true }
            }
          }
        })
      : [];

    const sharedFilesWithMeta = sharedFilesData.map((file) => {
      const shareInfo = sharedResources.find((sr) => sr.resourceId === file.id);
      return {
        ...file,
        size: file.size.toString(),
        isShared: true,
        isOwner: false,
        sharedBy: file.user?.name,
        sharedByEmail: file.user?.email,
        sharedAt: shareInfo?.createdAt,
        permission: shareInfo?.permission,
      };
    });

    /**
     * ==========================================
     * 3. 필터 및 페이지네이션 처리
     * ==========================================
     */
    let myFiles: any[] = [];
    let totalMyFiles = 0;

    if (filter === "all" || filter === "mine") {
      [myFiles, totalMyFiles] = await Promise.all([
        prisma.file.findMany({
          where: myFilesWhere,
          orderBy: { [sortBy]: sortOrder },
          // filter가 "all"일 때는 나중에 메모리에서 합치므로 skip/take를 여기서 하지 않음
          skip: filter === "mine" ? skip : undefined,
          take: filter === "mine" ? limit : undefined,
          include: {
            fileTags: {
              include: { tag: true }
            }
          }
        }),
        prisma.file.count({ where: myFilesWhere }),
      ]);
    }

    const myFilesWithMeta = myFiles.map((file) => ({
      ...file,
      size: file.size.toString(),
      isShared: false,
      isOwner: true,
    }));

    /**
     * ==========================================
     * 4. 최종 데이터 조합 및 정렬
     * ==========================================
     */
    let resultFiles: any[] = [];
    let finalTotal = 0;

    if (filter === "all") {
      // 내 파일(현재 폴더 내) + 공유받은 파일 전체
      const combined = [...myFilesWithMeta, ...sharedFilesWithMeta];
      
      // 정렬 로직
      combined.sort((a: any, b: any) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        return sortOrder === "desc" 
          ? (aVal > bVal ? -1 : 1) 
          : (aVal > bVal ? 1 : -1);
      });

      finalTotal = combined.length;
      resultFiles = combined.slice(skip, skip + limit);
    } else if (filter === "mine") {
      resultFiles = myFilesWithMeta;
      finalTotal = totalMyFiles;
    } else {
      // shared 필터
      sharedFilesWithMeta.sort((a: any, b: any) => {
        const aVal = a[sortBy];
        const bVal = b[sortBy];
        return sortOrder === "desc" ? (aVal > bVal ? -1 : 1) : (aVal > bVal ? 1 : -1);
      });
      finalTotal = sharedFilesWithMeta.length;
      resultFiles = sharedFilesWithMeta.slice(skip, skip + limit);
    }

    return NextResponse.json({
      files: resultFiles,
      pagination: {
        total: finalTotal,
        page,
        limit,
        totalPages: Math.ceil(finalTotal / limit),
      },
      stats: {
        myFiles: totalMyFiles,
        sharedFiles: sharedFilesWithMeta.length,
      },
    });

  } catch (error) {
    console.error("Files fetch error:", error);
    return NextResponse.json(
      { error: "파일 목록 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}