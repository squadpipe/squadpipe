-- AlterTable
ALTER TABLE "Submission"
  ALTER COLUMN "stage" DROP DEFAULT,
  ALTER COLUMN "stage" TYPE TEXT USING "stage"::text,
  ALTER COLUMN "stage" SET DEFAULT 'SUBMITTED';
