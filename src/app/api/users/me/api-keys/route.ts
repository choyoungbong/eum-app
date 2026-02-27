// src/app/api/users/me/api-keys/route.ts
// GET    — API 키 목록
// POST   — 새 API 키 생성

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";
import crypto from "crypto";
import bcrypt from "bcryptjs";

const MAX_KEYS = 10;
const VALID_SCOPES = ["read:files", "write:files", "read:posts", "write:posts", "read:profile"];

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id },
    select: {
      id: true, name: true, keyPrefix: true,
      scopes: true, lastUsedAt: true, expiresAt: true, createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ keys });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const count = await prisma.apiKey.count({ where: { userId: session.user.id } });
  if (count >= MAX_KEYS)
    return NextResponse.json({ error: `API 키는 최대 ${MAX_KEYS}개까지 생성할 수 있습니다` }, { status: 400 });

  const { name, scopes = [], expiresInDays } = await request.json();

  if (!name?.trim()) return NextResponse.json({ error: "이름이 필요합니다" }, { status: 400 });
  const validScopes = (scopes as string[]).filter((s) => VALID_SCOPES.includes(s));

  // eum_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx 형식
  const rawKey = `eum_${crypto.randomBytes(32).toString("hex")}`;
  const keyHash = await bcrypt.hash(rawKey, 10);
  const keyPrefix = rawKey.slice(0, 12); // "eum_xxxxxxxx"

  const expiresAt = expiresInDays
    ? new Date(Date.now() + expiresInDays * 86400000)
    : null;

  const key = await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      name: name.trim(),
      keyHash,
      keyPrefix,
      scopes: validScopes,
      expiresAt,
    },
  });

  // rawKey는 생성 직후 1번만 반환 (이후 조회 불가)
  return NextResponse.json({
    key: {
      id: key.id, name: key.name, keyPrefix: key.keyPrefix,
      scopes: key.scopes, expiresAt: key.expiresAt, createdAt: key.createdAt,
    },
    rawKey, // ⚠️ 지금 복사하지 않으면 다시 볼 수 없습니다
  });
}
