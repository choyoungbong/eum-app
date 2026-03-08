import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { createReadStream } from "fs"; // ✅ [품질-2] 이제 실제로 사용
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
    } catch {
      return NextResponse.json(
        { error: "파일이 존재하지 않습니다" },
        { status: 404 }
      );
    }

    // ✅ [성능-2] 전체 메모리 로드(Buffer.concat) → ReadableStream 스트리밍으로 교체
    // 기존: 파일 전체를 chunks 배열로 메모리에 올린 후 응답 → 대용량 파일 시 OOM 위험
    // 개선: Node.js ReadableStream을 Web ReadableStream으로 래핑하여 청크 단위로 전송
    const nodeStream = createReadStream(file.filepath);

    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on("data", (chunk) => {
          controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
        });
        nodeStream.on("end", () => {
          controller.close();
        });
        nodeStream.on("error", (err) => {
          controller.error(err);
        });
      },
      cancel() {
        // 클라이언트가 다운로드를 취소한 경우 스트림 정리
        nodeStream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        "Content-Type": file.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(file.originalName)}"`,
        // ✅ BigInt → Number 변환 (Content-Length는 문자열 숫자여야 함)
        "Content-Length": file.size.toString(),
        // ✅ 스트리밍 다운로드 진행률 표시를 위해 Accept-Ranges 허용
        "Accept-Ranges": "bytes",
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