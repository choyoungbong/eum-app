// =============================================
// 기존 업로드된 이미지 파일들의 썸네일 일괄 생성
// 실행: node scripts/generate-thumbnails.js
// =============================================

const { PrismaClient } = require("@prisma/client");
const sharp = require("sharp");
const { readFile, writeFile, mkdir } = require("fs/promises");
const { existsSync } = require("fs");
const { join } = require("path");

const prisma = new PrismaClient();
const STORAGE_PATH = process.env.STORAGE_PATH || "./storage";

async function generateThumbnails() {
  console.log("📸 썸네일 일괄 생성 시작...\n");

  const thumbnailDir = join(STORAGE_PATH, "thumbnails");
  if (!existsSync(thumbnailDir)) {
    await mkdir(thumbnailDir, { recursive: true });
    console.log("✅ thumbnails 디렉토리 생성\n");
  }

  // 이미지 파일만 조회 (thumbnailUrl이 null인 것만)
  const imageFiles = await prisma.file.findMany({
    where: {
      mimeType: { startsWith: "image/" },
      thumbnailUrl: null,
    },
  });

  console.log(`🔍 처리할 이미지 파일: ${imageFiles.length}개\n`);

  let successCount = 0;
  let failCount = 0;

  for (const file of imageFiles) {
    try {
      const buffer = await readFile(file.filepath);
      const thumbnailFilename = `thumb_${file.filename.replace(/\.\w+$/, ".jpg")}`;
      const thumbnailPath = join(thumbnailDir, thumbnailFilename);

      await sharp(buffer)
        .resize(300, 300, { fit: "cover", position: "center" })
        .jpeg({ quality: 80 })
        .toFile(thumbnailPath);

      await prisma.file.update({
        where: { id: file.id },
        data: { thumbnailUrl: `/api/files/thumbnail/${thumbnailFilename}` },
      });

      console.log(`✅ ${file.originalName} → 썸네일 생성 완료`);
      successCount++;
    } catch (error) {
      console.error(`❌ ${file.originalName} → 실패:`, error.message);
      failCount++;
    }
  }

  console.log(`\n📊 결과: 성공 ${successCount}개 / 실패 ${failCount}개`);
  await prisma.$disconnect();
}

generateThumbnails().catch((error) => {
  console.error("오류 발생:", error);
  process.exit(1);
});