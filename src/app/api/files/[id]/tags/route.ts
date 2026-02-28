import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

// 파일 태그 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const file = await prisma.file.findUnique({
      where: { id: params.id },
      include: {
        fileTags: { include: { tag: true } },
      },
    });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    return NextResponse.json({ tags: file.fileTags.map((ft: any) => ft.tag) });
  } catch (error) {
    console.error("Tag GET error:", error);
    return NextResponse.json(
      { error: "태그 조회 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 파일 태그 추가
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { tagName } = body;

    if (!tagName || !tagName.trim()) {
      return NextResponse.json(
        { error: "태그 이름을 입력하세요" },
        { status: 400 }
      );
    }

    // 파일 확인
    const file = await prisma.file.findUnique({ where: { id: params.id } });
    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 소유자 확인
    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { error: "태그를 추가할 권한이 없습니다" },
        { status: 403 }
      );
    }

    const normalizedName = tagName.trim().toLowerCase();

    // 태그 upsert (없으면 생성, 있으면 기존 사용)
    const tag = await prisma.tag.upsert({
      where: { name: normalizedName },
      update: {},
      create: { name: normalizedName },
    });

    // 이미 연결됐는지 확인
    const existing = await prisma.fileTag.findUnique({
      where: {
        fileId_tagId: { fileId: params.id, tagId: tag.id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "이미 추가된 태그입니다" },
        { status: 400 }
      );
    }

    // 파일-태그 연결
    await prisma.fileTag.create({
      data: { fileId: params.id, tagId: tag.id },
    });

    // 태그가 추가된 파일 전체 반환 (프론트에서 즉시 반영)
    const updatedFile = await prisma.file.findUnique({
      where: { id: params.id },
      include: {
        fileTags: { include: { tag: true } },
      },
    });

    // BigInt를 String으로 변환
    const serializedFile = updatedFile ? {
      ...updatedFile,
      size: updatedFile.size.toString(),
    } : null;

    return NextResponse.json(
      { message: "태그가 추가되었습니다", tag, file: serializedFile },
      { status: 201 }
    );
  } catch (error) {
    console.error("Tag POST error:", error);
    return NextResponse.json(
      { error: "태그 추가 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}

// 파일 태그 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const body = await request.json();
    const { tagId } = body;

    if (!tagId) {
      return NextResponse.json(
        { error: "tagId를 제공하세요" },
        { status: 400 }
      );
    }

    // 파일 확인 + 소유자 확인
    const file = await prisma.file.findUnique({ where: { id: params.id } });
    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }
    if (file.userId !== session.user.id) {
      return NextResponse.json(
        { error: "태그를 삭제할 권한이 없습니다" },
        { status: 403 }
      );
    }

    // 파일-태그 연결 삭제
    await prisma.fileTag.delete({
      where: {
        fileId_tagId: { fileId: params.id, tagId },
      },
    });

    // 업데이트된 파일 반환
    const updatedFile = await prisma.file.findUnique({
      where: { id: params.id },
      include: {
        fileTags: { include: { tag: true } },
      },
    });

    // BigInt를 String으로 변환
    const serializedFile = updatedFile ? {
      ...updatedFile,
      size: updatedFile.size.toString(),
    } : null;

    return NextResponse.json({
      message: "태그가 삭제되었습니다",
      file: serializedFile,
    });
  } catch (error) {
    console.error("Tag DELETE error:", error);
    return NextResponse.json(
      { error: "태그 삭제 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}