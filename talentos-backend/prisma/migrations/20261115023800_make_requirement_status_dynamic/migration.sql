-- AlterTable
ALTER TABLE "requirements"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE TEXT USING "status"::text,
  ALTER COLUMN "status" SET DEFAULT 'REQUIREMENT';
