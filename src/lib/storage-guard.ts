// src/lib/storage-guard.ts
// 파일 업로드 전 용량 제한 확인 유틸리티
// upload route에서 호출해 사용

import { prisma } from "@/lib/db";

const DEFAULT_LIMIT = BigInt(5 * 1024 * 1024 * 1024); // 5GB

export async function checkStorageQuota(
  userId: string,
  newFileSize: number
): Promise<{ allowed: boolean; used: bigint; limit: bigint; remaining: bigint }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageUsed: true, storageLimit: true },
  });

  const used  = user?.storageUsed  ?? BigInt(0);
  const limit = user?.storageLimit ?? DEFAULT_LIMIT;
  const remaining = limit - used;

  return {
    allowed: remaining >= BigInt(newFileSize),
    used, limit, remaining,
  };
}

/** 파일 업로드 완료 후 사용량 증가 */
export async function incrementStorage(userId: string, bytes: number) {
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsed: { increment: BigInt(bytes) } },
  });
}

/** 파일 삭제 후 사용량 감소 */
export async function decrementStorage(userId: string, bytes: bigint | number) {
  await prisma.user.update({
    where: { id: userId },
    data: { storageUsed: { decrement: BigInt(bytes) } },
  }).catch(() => {}); // 음수 방지를 위해 에러 무시
}
