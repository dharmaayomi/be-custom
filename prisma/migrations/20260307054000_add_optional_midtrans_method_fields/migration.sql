ALTER TABLE "public"."payments"
ADD COLUMN IF NOT EXISTS "midtransPaymentType" TEXT,
ADD COLUMN IF NOT EXISTS "midtransBank" TEXT,
ADD COLUMN IF NOT EXISTS "midtransReference" TEXT;
