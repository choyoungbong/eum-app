/*
  Warnings:

  - You are about to drop the column `updated_at` on the `comments` table. All the data in the column will be lost.
  - The `transcode_status` column on the `files` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `resource_type` on the `shared_resources` table. All the data in the column will be lost.
  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `reports` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[resourceType,resource_id,shared_with_id]` on the table `shared_resources` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `resourceType` to the `shared_resources` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- AlterEnum
ALTER TYPE "ResourceType" ADD VALUE 'FOLDER';

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_reporter_id_fkey";

-- DropForeignKey
ALTER TABLE "reports" DROP CONSTRAINT "reports_reviewed_by_fkey";

-- DropForeignKey
ALTER TABLE "shared_resources" DROP CONSTRAINT "shared_resources_post_fkey";

-- DropIndex
DROP INDEX "comments_post_id_idx";

-- DropIndex
DROP INDEX "comments_user_id_idx";

-- DropIndex
DROP INDEX "files_hash_idx";

-- DropIndex
DROP INDEX "files_user_id_idx";

-- DropIndex
DROP INDEX "posts_created_at_idx";

-- DropIndex
DROP INDEX "posts_user_id_idx";

-- DropIndex
DROP INDEX "shared_resources_owner_id_idx";

-- DropIndex
DROP INDEX "shared_resources_resource_type_resource_id_shared_with_id_key";

-- DropIndex
DROP INDEX "shared_resources_shared_with_id_idx";

-- AlterTable
ALTER TABLE "comments" DROP COLUMN "updated_at";

-- AlterTable
ALTER TABLE "files" ALTER COLUMN "hash" DROP NOT NULL,
DROP COLUMN "transcode_status",
ADD COLUMN     "transcode_status" TEXT DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "shared_resources" DROP COLUMN "resource_type",
ADD COLUMN     "resourceType" "ResourceType" NOT NULL;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "Role" NOT NULL DEFAULT 'USER';

-- DropTable
DROP TABLE "reports";

-- DropEnum
DROP TYPE "ReportReason";

-- DropEnum
DROP TYPE "ReportStatus";

-- DropEnum
DROP TYPE "TranscodeStatus";

-- DropEnum
DROP TYPE "UserRole";

-- CreateIndex
CREATE UNIQUE INDEX "shared_resources_resourceType_resource_id_shared_with_id_key" ON "shared_resources"("resourceType", "resource_id", "shared_with_id");

-- RenameForeignKey
ALTER TABLE "shared_resources" RENAME CONSTRAINT "shared_resources_file_fkey" TO "shared_resources_resource_id_fkey";
