-- DropIndex
DROP INDEX "Document_storageKey_key";

-- CreateIndex
CREATE INDEX "Document_storageKey_idx" ON "Document"("storageKey");
