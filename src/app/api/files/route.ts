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
    const sortOrder = searchParams.get("sortOrder") || "desc";
    
    // 검색 & 필터
    const search = searchParams.get("search") || "";
    const fileType = searchParams.get("fileType") || "";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const filter = searchParams.get("filter") || "all"; // all, mine, shared

    const skip = (page - 1) * limit;

    // 1. 내가 업로드한 파일 조회
    const myFilesWhere: any = {
      userId: session.user.id,
    };

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
      if (startDate) {
        myFilesWhere.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        myFilesWhere.createdAt.lte = new Date(endDate);
      }
    }

    // 2. 공유받은 파일 조회 (관계 없이)
    const sharedResources = await prisma.sharedResource.findMany({
      where: {
        resourceType: "FILE",
        sharedWithId: session.user.id,
      },
    });

    // 공유받은 파일 ID 목록
    const sharedFileIds = sharedResources.map((sr) => sr.resourceId);

    // 공유받은 파일 정보 조회
    const sharedFilesData = await prisma.file.findMany({
      where: {
        id: { in: sharedFileIds },
      },
    });

    // 각 공유 파일의 소유자 정보 조회
    const sharedFilesWithOwner = await Promise.all(
      sharedFilesData.map(async (file) => {
        const owner = await prisma.user.findUnique({
          where: { id: file.userId },
          select: {
            id: true,
            name: true,
            email: true,
          },
        });

        const shareInfo = sharedResources.find((sr) => sr.resourceId === file.id);

        return {
          ...file,
          user: owner,
          sharedBy: owner?.name,
          sharedByEmail: owner?.email,
          sharedAt: shareInfo?.createdAt,
          permission: shareInfo?.permission,
        };
      })
    );

    // 3. 필터에 따라 조회
    let myFiles: any[] = [];
    let totalMyFiles = 0;
    let totalSharedFiles = sharedFilesWithOwner.length;

    if (filter === "all" || filter === "mine") {
      // 내 파일 조회
      [myFiles, totalMyFiles] = await Promise.all([
        prisma.file.findMany({
          where: myFilesWhere,
          orderBy: { [sortBy]: sortOrder },
          skip: filter === "mine" ? skip : 0,
          take: filter === "mine" ? limit : undefined,
          select: {
            id: true,
            filename: true,
            originalName: true,
            size: true,
            mimeType: true,
            thumbnailUrl: true,
            transcodeStatus: true,
            createdAt: true,
            updatedAt: true,
          },
        }),
        prisma.file.count({ where: myFilesWhere }),
      ]);
    }

    // 4. 결과 조합
    let allFiles: any[] = [];

    if (filter === "all") {
      // 내 파일 + 공유받은 파일
      const myFilesWithMeta = myFiles.map((file) => ({
        ...file,
        size: file.size.toString(),
        isShared: false,
        isOwner: true,
      }));

      const sharedFilesWithMeta = sharedFilesWithOwner.map((file) => ({
        ...file,
        size: file.size.toString(),
        isShared: true,
        isOwner: false,
      }));

      // 합치기
      allFiles = [...myFilesWithMeta, ...sharedFilesWithMeta];

      // 정렬
      allFiles.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder === "desc") {
          return aValue > bValue ? -1 : 1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // 페이지네이션
      const startIndex = skip;
      const endIndex = skip + limit;
      allFiles = allFiles.slice(startIndex, endIndex);

    } else if (filter === "mine") {
      // 내 파일만
      allFiles = myFiles.map((file) => ({
        ...file,
        size: file.size.toString(),
        isShared: false,
        isOwner: true,
      }));

    } else if (filter === "shared") {
      // 공유받은 파일만
      allFiles = sharedFilesWithOwner.map((file) => ({
        ...file,
        size: file.size.toString(),
        isShared: true,
        isOwner: false,
      }));

      // 정렬
      allFiles.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        
        if (sortOrder === "desc") {
          return aValue > bValue ? -1 : 1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });

      // 페이지네이션
      const startIndex = skip;
      const endIndex = skip + limit;
      allFiles = allFiles.slice(startIndex, endIndex);
    }

    // 5. 총 개수 계산
    const total = filter === "all" 
      ? totalMyFiles + totalSharedFiles
      : filter === "mine"
      ? totalMyFiles
      : totalSharedFiles;

    return NextResponse.json({
      files: allFiles,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        myFiles: totalMyFiles,
        sharedFiles: totalSharedFiles,
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
