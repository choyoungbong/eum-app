import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth"; // ✅ [수정] route → lib/auth
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import sharp from "sharp";
import { fileTypeFromBuffer } from "file-type";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || "52428800");

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg", "image/png", "image/gif", "image/webp",
  "application/pdf", "video/mp4", "video/webm",
  "application/zip", "text/plain",
]);

const uploadRateMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

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
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
    }

    const rateResult = checkRateLimit(session.user.id);
    if (!rateResult.allowed) {
      return NextResponse.json(
        { error: "잠시 후 다시 시도해주세요. 업로드 한도에 도달했습니다." },
        { status: 429, headers: { "Retry-After": String(rateResult.retryAfter ?? 60) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const folderId = formData.get("folderId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "파일을 선택해주세요" }, { status: 400 });
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `파일 크기는 ${MAX_FILE_SIZE / (1024 * 1024)}MB를 초과할 수 없습니다` },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ [보안-2] magic bytes로 실제 MIME 타입 검증
    const detectedType = await fileTypeFromBuffer(buffer);
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

    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

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

    const fileExtension = file.name.split(".").pop() || "bin";
    const uniqueFilename = `${crypto.randomUUID()}.${fileExtension}`;

    const uploadDir = join(STORAGE_PATH, "files");
    const thumbnailDir = join(STORAGE_PATH, "thumbnails");

    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
    if (!existsSync(thumbnailDir)) await mkdir(thumbnailDir, { recursive: true });

    const filepath = join(uploadDir, uniqueFilename);
    await writeFile(filepath, buffer);

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
      }
    }

    try {
      const savedFile = await prisma.file.create({
        data: {
          filename: uniqueFilename,
          originalName: file.name,
          filepath: filepath,
          size: BigInt(file.size),
          mimeType: actualMimeType,
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
