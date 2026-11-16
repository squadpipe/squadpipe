-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN "vendorId" TEXT;

-- CreateIndex
CREATE INDEX "Candidate_vendorId_idx" ON "Candidate"("vendorId");

-- AddForeignKey
ALTER TABLE "Candidate" ADD CONSTRAINT "Candidate_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
