// src/app/api/users/me/avatar/route.ts
// POST — 아바타 또는 커버 이미지 업로드

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import { writeFile, mkdir, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import sharp from "sharp";
import crypto from "crypto";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "./storage";
const AVATAR_DIR   = path.join(STORAGE_PATH, "avatars");
const COVER_DIR    = path.join(STORAGE_PATH, "covers");

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const formData = await request.formData();
  const file     = formData.get("file") as File | null;
  const type     = formData.get("type") as "avatar" | "cover" | null;

  if (!file)                    return NextResponse.json({ error: "파일이 필요합니다" }, { status: 400 });
  if (!["avatar", "cover"].includes(type ?? ""))
    return NextResponse.json({ error: "type은 avatar 또는 cover여야 합니다" }, { status: 400 });
  if (!file.type.startsWith("image/"))
    return NextResponse.json({ error: "이미지 파일만 업로드 가능합니다" }, { status: 400 });
  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "파일 크기는 5MB 이하여야 합니다" }, { status: 400 });

  const isAvatar = type === "avatar";
  const dir      = isAvatar ? AVATAR_DIR : COVER_DIR;
  if (!existsSync(dir)) await mkdir(dir, { recursive: true });

  const id      = crypto.randomUUID();
  const outPath = path.join(dir, `${session.user.id}_${id}.webp`);

  const bytes  = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  // 아바타: 400x400 정사각형 / 커버: 1200x400
  await sharp(buffer)
    .rotate()
    .resize(
      isAvatar ? 400 : 1200,
      isAvatar ? 400 : 400,
      { fit: isAvatar ? "cover" : "cover", position: "attention" }
    )
    .webp({ quality: 85 })
    .toFile(outPath);

  // 기존 파일 삭제
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { avatarUrl: true, coverUrl: true },
  });
  const oldPath = isAvatar ? user?.avatarUrl : user?.coverUrl;
  if (oldPath && existsSync(oldPath)) await unlink(oldPath).catch(() => {});

  // DB 업데이트
  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: isAvatar
      ? { avatarUrl: outPath }
      : { coverUrl:  outPath },
    select: { avatarUrl: true, coverUrl: true },
  });

  // 공개 URL 반환 (Next.js image serving API 통해)
  const publicUrl = `/api/users/me/avatar?type=${type}&v=${id}`;
  return NextResponse.json({ url: outPath, publicUrl, message: "업로드 완료" });
}

// GET — 아바타/커버 이미지 파일 서빙
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  const userId  = new URL(request.url).searchParams.get("userId") ?? session?.user?.id;
  const type    = new URL(request.url).searchParams.get("type") ?? "avatar";

  if (!userId) return new NextResponse(null, { status: 404 });

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true, coverUrl: true },
  });

  const filePath = type === "avatar" ? user?.avatarUrl : user?.coverUrl;
  if (!filePath || !existsSync(filePath)) return new NextResponse(null, { status: 404 });

  const { readFile } = await import("fs/promises");
  const data = await readFile(filePath);
  return new NextResponse(data, {
    headers: {
      "Content-Type": "image/webp",
      "Cache-Control": "public, max-age=3600",
    },
  });
}

// ── schema.prisma User 모델에 추가 ─────────────────────────
// avatarUrl  String? @map("avatar_url")
// coverUrl   String? @map("cover_url")
