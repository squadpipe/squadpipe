-- Drop tenant-level SMTP config column (outbound SMTP uses server environment variables)
ALTER TABLE "tenant_settings" DROP COLUMN IF EXISTS "smtp_config";

-- CreateTable VendorContact for multi-contact vendor management
CREATE TABLE IF NOT EXISTS "VendorContact" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "designation" TEXT NOT NULL DEFAULT '',
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorContact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VendorContact_vendorId_idx" ON "VendorContact"("vendorId");
CREATE INDEX IF NOT EXISTS "VendorContact_email_idx" ON "VendorContact"("email");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'VendorContact_vendorId_fkey'
    ) THEN
        ALTER TABLE "VendorContact"
        ADD CONSTRAINT "VendorContact_vendorId_fkey"
        FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
