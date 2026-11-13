-- DropIndex
DROP INDEX "MasterTaxonomy_category_optionValue_key";

-- AlterTable
ALTER TABLE "MasterTaxonomy" ADD COLUMN     "tenantId" TEXT NOT NULL DEFAULT 'talentos-agency';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "MasterTaxonomy_tenantId_idx" ON "MasterTaxonomy"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "MasterTaxonomy_tenantId_category_optionValue_key" ON "MasterTaxonomy"("tenantId", "category", "optionValue");

