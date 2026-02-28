// src/lib/storage-guard.ts
import { prisma } from "@/lib/db";

export async function checkStorageLimit(userId: string, newFileSize: number) {
  // 1. 사용자의 용량 제한 및 현재 사용량 조회
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageLimit: true },
  });

  if (!user) throw new Error("사용자를 찾을 수 없습니다.");

  // 2. 현재 총 사용량 계산 (_sum.size는 BigInt를 반환함)
  const storageUsed = await prisma.file.aggregate({
    where: { userId },
    _sum: { size: true },
  });

  const used = storageUsed._sum.size || BigInt(0);
  const limit = user.storageLimit; // DB의 BigInt 타입
  const remaining = limit - used;

  return {
    // 모든 반환 값을 BigInt로 통일하거나, 비교 결과만 반환
    allowed: remaining >= BigInt(newFileSize),
    used: used,
    limit: limit,
    remaining: remaining,
  };
}

/**
 * 용량 단위를 사람이 읽기 편한 문자열로 변환 (BigInt 대응)
 */
export function formatBytes(bytes: bigint | number, decimals = 2) {
  const b = BigInt(bytes);
  if (b === BigInt(0)) return "0 Bytes";

  const k = BigInt(1024);
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB"];

  // BigInt 계산을 위해 숫자로 변환하여 지수 계산
  const i = Math.floor(Math.log(Number(b)) / Math.log(1024));

  return (
    parseFloat((Number(b) / Math.pow(1024, i)).toFixed(dm)) + " " + sizes[i]
  );
}