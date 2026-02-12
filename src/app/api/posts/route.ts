import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { z } from "zod";

const postSchema = z.object({
  title: z.string().min(1, "제목을 입력하세요").max(200),
  content: z.string().min(1, "내용을 입력하세요"),
  visibility: z.enum(["PRIVATE", "SHARED", "PUBLIC"]).optional(),
});

// 게시글 목록 조회
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
    const visibility = searchParams.get("visibility");
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    // 1. 나에게 공유된 게시글 ID 목록
    const sharedPosts = await prisma.sharedResource.findMany({
      where: {
        resourceType: "POST",
        sharedWithId: session.user.id,
      },
      select: {
        resourceId: true,
      },
    });

    const sharedPostIds = sharedPosts.map((sr) => sr.resourceId);

    // 2. 조회 조건 구성
    let where: any = {};
    
    if (visibility === "my") {
      // 내 글만
      where.userId = session.user.id;
    } else if (visibility === "public") {
      // 공개 글만
      where.visibility = "PUBLIC";
    } else if (visibility === "shared") {
      // 나에게 공유된 글만
      where.id = { in: sharedPostIds };
    } else {
      // 전체 (기본)
      where.OR = [
        { userId: session.user.id },           // 내가 작성한 글
        { visibility: "PUBLIC" },              // 공개 글
        { id: { in: sharedPostIds } },         // 나에게 공유된 글
      ];
    }

    // 검색어 필터
    if (search) {
      const searchCondition = {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } },
        ],
      };

      if (where.OR) {
        where.AND = [
          { OR: where.OR },
          searchCondition,
        ];
        delete where.OR;
      } else {
        where.AND = [searchCondition];
      }
    }

    const [posts, total] = await Promise.all([
      prisma.post.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          _count: {
            select: {
              comments: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.post.count({ where }),
    ]);

    // 3. 각 게시글에 공유 정보 추가
    const postsWithShareInfo = await Promise.all(
      posts.map(async (post) => {
        const isShared = sharedPostIds.includes(post.id);
        let sharedBy = null;

        if (isShared && post.userId !== session.user.id) {
          // 공유받은 게시글인 경우 공유자 정보 조회
          const shareInfo = await prisma.sharedResource.findFirst({
            where: {
              resourceType: "POST",
              resourceId: post.id,
              sharedWithId: session.user.id,
            },
            include: {
              owner: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          });

          if (shareInfo) {
            sharedBy = shareInfo.owner.name;
          }
        }

        return {
          ...post,
          isOwner: post.userId === session.user.id,
          isShared: isShared && post.userId !== session.user.id,
          sharedBy,
        };
      })
    );

    return NextResponse.json({
      posts: postsWithShareInfo,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });

  } catch (error) {
    console.error("Posts fetch error:", error);
    return NextResponse.json(
      { error: "게시글 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 게시글 생성
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const validation = postSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { title, content, visibility = "PRIVATE" } = validation.data;

    const post = await prisma.post.create({
      data: {
        title,
        content,
        visibility,
        userId: session.user.id,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(
      {
        message: "게시글이 작성되었습니다",
        post,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("Post create error:", error);
    return NextResponse.json(
      { error: "게시글 작성 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
