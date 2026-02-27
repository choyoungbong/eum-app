// src/app/api/files/[id]/encrypt/route.ts
// POST — 파일에 비밀번호 설정 (AES-256-GCM 암호화)
// DELETE — 비밀번호 해제 (복호화)

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import { readFile, writeFile } from "fs/promises";
import { existsSync } from "fs";

const ALGO = "aes-256-gcm";

function deriveKey(password: string, salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(password, salt, 100_000, 32, "sha256");
}

// POST — 암호화 (잠금)
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { password } = await request.json();
  if (!password || password.length < 4)
    return NextResponse.json({ error: "비밀번호는 4자 이상이어야 합니다" }, { status: 400 });

  const file = await prisma.file.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  if (file.isEncrypted) return NextResponse.json({ error: "이미 암호화된 파일입니다" }, { status: 400 });
  if (!existsSync(file.filepath))
    return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });

  // AES-256-GCM 암호화
  const salt = crypto.randomBytes(16);
  const iv   = crypto.randomBytes(12);
  const key  = deriveKey(password, salt);
  const cipher = crypto.createCipheriv(ALGO, key, iv);

  const plaintext = await readFile(file.filepath);
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag   = cipher.getAuthTag();

  // 형식: [4B salt_len][salt][12B iv][16B authTag][encrypted]
  const out = Buffer.concat([
    Buffer.from([salt.length]),
    salt, iv, authTag, encrypted,
  ]);
  await writeFile(file.filepath, out);

  await prisma.file.update({
    where: { id: params.id },
    data: { isEncrypted: true },
  });

  return NextResponse.json({ message: "파일이 암호화되었습니다" });
}

// DELETE — 복호화 (잠금 해제)
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const { password } = await request.json();
  if (!password) return NextResponse.json({ error: "비밀번호가 필요합니다" }, { status: 400 });

  const file = await prisma.file.findFirst({
    where: { id: params.id, userId: session.user.id },
  });
  if (!file) return NextResponse.json({ error: "파일을 찾을 수 없습니다" }, { status: 404 });
  if (!file.isEncrypted) return NextResponse.json({ error: "암호화되지 않은 파일입니다" }, { status: 400 });

  try {
    const raw   = await readFile(file.filepath);
    const saltLen = raw[0];
    const salt  = raw.slice(1, 1 + saltLen);
    const iv    = raw.slice(1 + saltLen, 1 + saltLen + 12);
    const authTag = raw.slice(1 + saltLen + 12, 1 + saltLen + 12 + 16);
    const ciphertext = raw.slice(1 + saltLen + 12 + 16);

    const key = deriveKey(password, salt);
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    await writeFile(file.filepath, decrypted);

    await prisma.file.update({
      where: { id: params.id },
      data: { isEncrypted: false },
    });

    return NextResponse.json({ message: "암호화가 해제되었습니다" });
  } catch {
    return NextResponse.json({ error: "비밀번호가 올바르지 않습니다" }, { status: 400 });
  }
}
