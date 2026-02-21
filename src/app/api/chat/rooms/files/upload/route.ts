import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;
    const roomId = formData.get("roomId") as string;

    if (!file || !roomId) {
      return NextResponse.json(
        { error: "파일과 채팅방 ID가 필요합니다" },
        { status: 400 }
      );
    }

    // 채팅방 멤버 확인
    const membership = await prisma.chatRoomMember.findFirst({
      where: {
        chatRoomId: roomId,
        userId: session.user.id,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "채팅방에 접근할 수 없습니다" },
        { status: 403 }
      );
    }

    // 파일 저장
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const fileExt = path.extname(file.name);
    const filename = `${uuidv4()}${fileExt}`;
    const storagePath = process.env.STORAGE_PATH || "./storage";
    const uploadDir = path.join(storagePath, "chat");

    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    // 썸네일 생성 (이미지인 경우)
    let thumbnailUrl = null;
    if (file.type.startsWith("image/")) {
      const thumbnailFilename = `thumb_${filename}`;
      const thumbnailPath = path.join(uploadDir, thumbnailFilename);

      await sharp(buffer)
        .resize(300, 300, { fit: "cover" })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      thumbnailUrl = `/api/chat/files/${thumbnailFilename}`;
    }

    // DB에 파일 정보 저장 (path 제거!)
    const chatFile = await prisma.file.create({
      data: {
        filename,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
        filepath: filePath,      // ← path 대신 filepath만 사용!
        thumbnailUrl,
        userId: session.user.id,
      },
    });

    // 채팅 메시지 생성
    const message = await prisma.chatMessage.create({
      data: {
        chatRoomId: roomId,
        senderId: session.user.id,
        content: file.name,
        type: "FILE",
        fileId: chatFile.id,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        file: true,
      },
    });

    return NextResponse.json({
      message,
      file: {
        id: chatFile.id,
        url: `/api/files/download/${filename}`,
        thumbnailUrl,
        name: file.name,
        size: file.size,
        type: file.type,
      },
    });
  } catch (error) {
    console.error("Chat file upload error:", error);
    return NextResponse.json(
      { error: "파일 업로드 실패" },
      { status: 500 }
    );
  }
}
