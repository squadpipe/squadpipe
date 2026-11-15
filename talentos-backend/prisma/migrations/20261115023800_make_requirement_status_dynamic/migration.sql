-- AlterTable
ALTER TABLE "Requirement"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE TEXT USING "status"::text,
  ALTER COLUMN "status" SET DEFAULT 'REQUIREMENT';
