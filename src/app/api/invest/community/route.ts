import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { db } from "@/lib/db";

const INVEST_CATEGORIES = ["KOSPI", "KOSDAQ", "NASDAQ", "SP500", "CRYPTO", "LOTTO", "FREE"] as const;
type InvestCategory = typeof INVEST_CATEGORIES[number];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") as InvestCategory | null;
  const page  = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = 20;
  const skip  = (page - 1) * limit;

  const where: any = {
    category: category && INVEST_CATEGORIES.includes(category) ? category : { in: INVEST_CATEGORIES },
    OR: [
      { visibility: "PUBLIC" },
      { userId: session.user.id },
    ],
  };

  const [posts, total] = await Promise.all([
    db.post.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
      select: {
        id: true, title: true, content: true,
        category: true, visibility: true, createdAt: true,
        user: { select: { id: true, name: true } },
        _count: { select: { comments: true } },
        postTags: { select: { tag: { select: { id: true, name: true } } } },
      },
    }),
    db.post.count({ where }),
  ]);

  return NextResponse.json({
    posts,
    pagination: { total, page, limit, hasNext: skip + limit < total },
  });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title, content, category, visibility, tags } = await req.json();
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: "제목과 내용을 입력하세요" }, { status: 400 });
  }
  if (!INVEST_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: "유효하지 않은 카테고리입니다" }, { status: 400 });
  }

  const post = await db.post.create({
    data: {
      title: title.trim(),
      content: content.trim(),
      category,
      visibility: visibility ?? "PUBLIC",
      userId: session.user.id,
      ...(tags?.length > 0 && {
        postTags: {
          create: await Promise.all(
            (tags as string[]).map(async (name: string) => {
              const tag = await db.tag.upsert({
                where: { name },
                create: { name, userId: session.user.id },
                update: {},
              });
              return { tagId: tag.id };
            })
          ),
        },
      }),
    },
    select: { id: true },
  });

  return NextResponse.json(post, { status: 201 });
}
