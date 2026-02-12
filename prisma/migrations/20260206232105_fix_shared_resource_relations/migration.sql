-- RenameForeignKey
ALTER TABLE "shared_resources" RENAME CONSTRAINT "shared_resources_resource_id_fkey" TO "shared_resources_file_fkey";

-- AddForeignKey
ALTER TABLE "shared_resources" ADD CONSTRAINT "shared_resources_post_fkey" FOREIGN KEY ("resource_id") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
