// src/lib/image-optimizer.ts
// sharp 기반 이미지 최적화 파이프라인
// npm install sharp && npm install --save-dev @types/sharp

import sharp from "sharp";
import path from "path";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";

const STORAGE_PATH = process.env.STORAGE_PATH ?? "./storage";
const OPTIMIZED_DIR = path.join(STORAGE_PATH, "optimized");
const THUMBNAIL_DIR = path.join(STORAGE_PATH, "thumbnails");

// 지원 입력 형식
const IMAGE_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png",
  "image/webp", "image/gif", "image/avif", "image/tiff",
]);

export function isImage(mimeType: string): boolean {
  return IMAGE_TYPES.has(mimeType);
}

export interface OptimizeResult {
  optimizedPath: string;
  thumbnailPath: string;
  originalSize:  number;
  optimizedSize: number;
  width:         number;
  height:        number;
  format:        string;
}

interface OptimizeOptions {
  maxWidth?:    number;   // 기본 2048px
  maxHeight?:   number;   // 기본 2048px
  quality?:     number;   // WebP 품질 (기본 82)
  thumbSize?:   number;   // 썸네일 크기 (기본 320px)
  keepOriginal?: boolean; // 원본 보존 여부
}

export async function optimizeImage(
  inputPath: string,
  filename:  string,
  opts: OptimizeOptions = {}
): Promise<OptimizeResult> {
  const {
    maxWidth    = 2048,
    maxHeight   = 2048,
    quality     = 82,
    thumbSize   = 320,
  } = opts;

  // 디렉토리 생성
  if (!existsSync(OPTIMIZED_DIR)) await mkdir(OPTIMIZED_DIR, { recursive: true });
  if (!existsSync(THUMBNAIL_DIR)) await mkdir(THUMBNAIL_DIR, { recursive: true });

  const baseName     = path.basename(filename, path.extname(filename));
  const optimizedPath = path.join(OPTIMIZED_DIR, `${baseName}.webp`);
  const thumbnailPath = path.join(THUMBNAIL_DIR, `${baseName}_thumb.webp`);

  // 원본 메타데이터
  const metadata = await sharp(inputPath).metadata();
  const originalSize = (await import("fs")).statSync(inputPath).size;

  // 최적화 (WebP 변환 + 리사이즈)
  await sharp(inputPath)
    .rotate()                        // EXIF orientation 자동 보정
    .resize(maxWidth, maxHeight, {
      fit:           "inside",
      withoutEnlargement: true,      // 원본보다 크게 확대 안 함
    })
    .webp({ quality, effort: 4 })   // effort: 0(빠름) ~ 6(높은 압축)
    .toFile(optimizedPath);

  // 썸네일 생성
  await sharp(inputPath)
    .rotate()
    .resize(thumbSize, thumbSize, { fit: "cover", position: "attention" })
    .webp({ quality: 75, effort: 3 })
    .toFile(thumbnailPath);

  const optimizedSize = (await import("fs")).statSync(optimizedPath).size;

  return {
    optimizedPath,
    thumbnailPath,
    originalSize,
    optimizedSize,
    width:  metadata.width  ?? 0,
    height: metadata.height ?? 0,
    format: "webp",
  };
}

/**
 * 업로드 route에 통합 예시:
 *
 * import { isImage, optimizeImage } from "@/lib/image-optimizer";
 *
 * if (isImage(file.type)) {
 *   const result = await optimizeImage(savedPath, file.name);
 *   // DB에 thumbnailUrl = result.thumbnailPath 저장
 *   // filepath = result.optimizedPath (WebP로 교체)
 *   console.log(`압축률: ${Math.round((1 - result.optimizedSize / result.originalSize) * 100)}%`);
 * }
 */

// ── 배치 재변환 (기존 이미지 일괄 처리) ─────────────────
export async function batchOptimizeExistingImages(
  userId?: string
): Promise<{ processed: number; skipped: number; savedBytes: bigint }> {
  const { prisma } = await import("@/lib/db");

  const files = await prisma.file.findMany({
    where: {
      ...(userId ? { userId } : {}),
      mimeType: { in: [...IMAGE_TYPES] },
      deletedAt: null,
    },
    select: { id: true, filepath: true, originalName: true, mimeType: true },
    take: 100, // 배치 크기
  });

  let processed = 0, skipped = 0;
  let savedBytes = BigInt(0);

  for (const file of files) {
    if (!existsSync(file.filepath)) { skipped++; continue; }
    try {
      const result = await optimizeImage(file.filepath, file.originalName);
      const saved  = BigInt(result.originalSize - result.optimizedSize);
      savedBytes  += saved > 0 ? saved : BigInt(0);

      await prisma.file.update({
        where: { id: file.id },
        data: {
          filepath:     result.optimizedPath,
          thumbnailUrl: result.thumbnailPath,
          size:         BigInt(result.optimizedSize),
        },
      });
      processed++;
    } catch { skipped++; }
  }

  return { processed, skipped, savedBytes };
}
