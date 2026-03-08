import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type"; // ✅ [보안-2] magic bytes 검증용 (npm install file-type)

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || "52428800"); // 50MB

// ✅ [보안-2] 허용 MIME 타입 화이트리스트
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
  "video/mp4",
  "video/webm",
  "application/zip",
  "text/plain",
]);

// ✅ [보안-4] Rate Limiting: 유저별 업로드 횟수 인메모리 추적
// 프로덕션에서는 Redis 기반 rate-limit 라이브러리로 교체 권장
const uploadRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;        // 최대 횟수
const RATE_WINDOW_MS = 60_000; // 1분

function checkRateLimit(userId: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = uploadRateMap.get(userId);

  if (!entry || now > entry.resetAt) {
    uploadRateMap.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true };
  }

  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, retryAfter: Math.ceil((entry.resetAt - now) / 1000) };
  }

  entry.count += 1;
  return { allowed: true };
}

export async function POST(request: NextRequest) {
  try {
    // 1. 세션 확인
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    // ✅ [보안-4] Rate Limiting 체크
    const rateResult = checkRateLimit(session.user.id);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해주세요. 업로드 한도에 도달했습니다." },
        {
          status: 429,
          headers: { "Retry-After": String(rateResult.retryAfter ?? 60) },
        }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folderId = formData.get("folderId") as string | null;

    // 2. 파일 유효성 검사
    if (!file) {
      return NextResponse.json({ error: "파일을 선택해주세요" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / (1024 * 1024)}MB를 초과할 수 없습니다` },
        { status: 400 }
      );
    }

    // 3. 파일 버퍼 읽기
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ [보안-2] magic bytes로 실제 MIME 타입 검증 (브라우저 제공값 신뢰 안 함)
    const detectedType = await fileTypeFromBuffer(buffer);

    // text/plain 은 magic bytes가 없으므로 브라우저 타입으로 fallback
    const actualMimeType = detectedType?.mime ?? (file.type === "text/plain" ? "text/plain" : null);

    if (!actualMimeType || !ALLOWED_MIME_TYPES.has(actualMimeType)) {
      return NextResponse.json(
        {
          error: "허용되지 않는 파일 형식입니다.",
          detected: actualMimeType ?? "unknown",
          allowed: Array.from(ALLOWED_MIME_TYPES),
        },
        { status: 400 }
      );
    }

    // 4. 파일 해시 생성 (중복 체크용)
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    /**
     * 5. 시스템 전체 중복 확인 (Hash 기반)
     * DB의 hash 필드에 @unique 제약조건이 있으므로,
     * 다른 유저가 올린 파일이라도 해시가 같으면 create 시 에러가 발생합니다.
     */
    const existingFile = await prisma.file.findFirst({
      where: { hash: fileHash },
    });

    if (existingFile) {
      const isMine = existingFile.userId === session.user.id;
      return NextResponse.json(
        {
          error: isMine
            ? "이미 내 보관함에 동일한 파일이 존재합니다."
            : "이미 시스템에 등록된 동일한 내용의 파일입니다.",
          existingFile: { id: existingFile.id, originalName: existingFile.originalName },
        },
        { status: 409 }
      );
    }

    // 6. 고유 파일명 및 경로 설정
    const fileExtension = file.name.split(".").pop() || "bin";
    const uniqueFilename = `${crypto.randomUUID()}.${fileExtension}`;

    const uploadDir = join(STORAGE_PATH, "files");
    const thumbnailDir = join(STORAGE_PATH, "thumbnails");

    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
    if (!existsSync(thumbnailDir)) await mkdir(thumbnailDir, { recursive: true });

    // 7. 물리 파일 저장
    const filepath = join(uploadDir, uniqueFilename);
    await writeFile(filepath, buffer);

    // 8. 썸네일 생성 (이미지인 경우만, 검증된 MIME 타입 사용)
    let thumbnailUrl: string | null = null;
    if (actualMimeType.startsWith("image/")) {
      try {
        const thumbnailFilename = `thumb_${uniqueFilename.replace(/\.\w+$/, ".jpg")}`;
        const thumbnailPath = join(thumbnailDir, thumbnailFilename);

        await sharp(buffer)
          .resize(300, 300, { fit: "cover", position: "center" })
          .jpeg({ quality: 80 })
          .toFile(thumbnailPath);

        thumbnailUrl = `/api/files/thumbnail/${thumbnailFilename}`;
      } catch (err) {
        console.error("Thumbnail generation failed:", err);
        // 썸네일 실패는 파일 업로드 자체를 중단시키지 않음
      }
    }

    /**
     * 9. DB 저장 및 최종 중복 에러 핸들링
     * findFirst 이후 create 직전에 다른 요청이 들어올 경우를 대비해
     * Prisma의 P2002(Unique 제약 위반) 에러를 Catch합니다.
     */
    try {
      const savedFile = await prisma.file.create({
        data: {
          filename: uniqueFilename,
          originalName: file.name,
          filepath: filepath,
          size: BigInt(file.size),
          mimeType: actualMimeType, // ✅ 검증된 실제 MIME 타입으로 저장
          hash: fileHash,
          thumbnailUrl,
          userId: session.user.id,
          folderId: folderId || null,
        },
      });

      return NextResponse.json(
        {
          message: "파일이 업로드되었습니다",
          file: {
            id: savedFile.id,
            filename: savedFile.filename,
            originalName: savedFile.originalName,
            size: savedFile.size.toString(),
            mimeType: savedFile.mimeType,
            thumbnailUrl: savedFile.thumbnailUrl,
            createdAt: savedFile.createdAt,
          },
        },
        { status: 201 }
      );
    } catch (dbError: any) {
      if (dbError.code === "P2002") {
        return NextResponse.json(
          { error: "이미 존재하는 파일입니다(중복 데이터)." },
          { status: 409 }
        );
      }
      throw dbError;
    }
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json(
      { error: "파일 업로드 중 오류가 발생했습니다" },
      { status: 500 }
    );
  }
}