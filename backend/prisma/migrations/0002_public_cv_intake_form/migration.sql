-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "publicDescription" TEXT,
ADD COLUMN     "publicFormEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "publicFormToken" TEXT;

-- AlterTable
ALTER TABLE "Submission" ADD COLUMN     "intakeSource" TEXT NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "submittedRate" TEXT,
ADD COLUMN     "submittedVendorName" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Requirement_publicFormToken_key" ON "Requirement"("publicFormToken");

