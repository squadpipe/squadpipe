-- AlterTable
ALTER TABLE "Requirement" ADD COLUMN     "openPositions" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "Submission_requirementId_candidateId_key" ON "Submission"("requirementId", "candidateId");

