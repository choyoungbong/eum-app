import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import crypto from "crypto";
import sharp from "sharp";

const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";
const MAX_FILE_SIZE = parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || "52428800"); // 50MB

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });
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

    // 파일 데이터
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const fileHash = crypto.createHash("sha256").update(buffer).digest("hex");

    // 중복 확인
    const existingFile = await prisma.file.findFirst({
      where: { hash: fileHash, userId: session.user.id },
    });

    if (existingFile) {
      return NextResponse.json(
        { error: "이미 업로드된 파일입니다", existingFile: { id: existingFile.id, originalName: existingFile.originalName } },
        { status: 409 }
      );
    }

    // 파일명 생성
    const fileExtension = file.name.split(".").pop() || "bin";
    const uniqueFilename = `${crypto.randomUUID()}.${fileExtension}`;

    // 디렉토리 생성
    const uploadDir = join(STORAGE_PATH, "files");
    const thumbnailDir = join(STORAGE_PATH, "thumbnails");
    if (!existsSync(uploadDir)) await mkdir(uploadDir, { recursive: true });
    if (!existsSync(thumbnailDir)) await mkdir(thumbnailDir, { recursive: true });

    // 파일 저장
    const filepath = join(uploadDir, uniqueFilename);
    await writeFile(filepath, buffer);

    // 썸네일 생성 (이미지인 경우만)
    let thumbnailUrl: string | null = null;
    if (file.type.startsWith("image/")) {
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
        // 썸네일 실패해도 업로드는 계속
      }
    }

    // DB 저장
    const savedFile = await prisma.file.create({
      data: {
        filename: uniqueFilename,
        originalName: file.name,
        filepath: filepath,
        size: BigInt(file.size),
        mimeType: file.type,
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
  } catch (error) {
    console.error("File upload error:", error);
    return NextResponse.json({ error: "파일 업로드 중 오류가 발생했습니다" }, { status: 500 });
  }
}