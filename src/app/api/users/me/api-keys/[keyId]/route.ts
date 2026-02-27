// src/app/api/users/me/api-keys/[keyId]/route.ts
// DELETE — API 키 삭제

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { prisma } from "@/lib/db";

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { keyId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: "인증이 필요합니다" }, { status: 401 });

  const key = await prisma.apiKey.findFirst({
    where: { id: params.keyId, userId: session.user.id },
  });
  if (!key) return NextResponse.json({ error: "API 키를 찾을 수 없습니다" }, { status: 404 });

  await prisma.apiKey.delete({ where: { id: params.keyId } });
  return NextResponse.json({ message: "API 키가 삭제되었습니다" });
}

// ─────────────────────────────────────────────────────────
// src/lib/api-key-auth.ts
// 외부 API 엔드포인트에서 Bearer 토큰 인증 시 사용
// ─────────────────────────────────────────────────────────
//
// import { verifyApiKey } from "@/lib/api-key-auth";
//
// export async function GET(request: NextRequest) {
//   const auth = await verifyApiKey(request, ["read:files"]);
//   if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 });
//   const { userId } = auth;
//   ...
// }
