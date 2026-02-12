import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { createReadStream } from "fs";
import { stat } from "fs/promises";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json(
        { error: "인증이 필요합니다" },
        { status: 401 }
      );
    }

    const fileId = params.id;

    // 파일 조회
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return NextResponse.json(
        { error: "파일을 찾을 수 없습니다" },
        { status: 404 }
      );
    }

    // 권한 확인 (소유자 또는 공유받은 사용자)
    const isOwner = file.userId === session.user.id;
    
    if (!isOwner) {
      const sharedResource = await prisma.sharedResource.findFirst({
        where: {
          resourceType: "FILE",
          resourceId: fileId,
          sharedWithId: session.user.id,
        },
      });

      if (!sharedResource) {
        return NextResponse.json(
          { error: "파일에 접근할 권한이 없습니다" },
          { status: 403 }
        );
      }
    }

    // 파일 존재 확인
    try {
      await stat(file.filepath);
    } catch (error) {
      return NextResponse.json(
        { error: "파일이 존재하지 않습니다" },
        { status: 404 }
      );
    }

    // 파일 스트림 읽기
    const fileStream = createReadStream(file.filepath);
    const chunks: Buffer[] = [];

    for await (const chunk of fileStream) {
      chunks.push(Buffer.from(chunk));
    }

    const buffer = Buffer.concat(chunks);

    // 파일 다운로드 응답
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("File download error:", error);
    return NextResponse.json(
      { error: "파일 다운로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}
