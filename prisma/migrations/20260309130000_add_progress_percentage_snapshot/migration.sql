ALTER TABLE "public"."payments"
ADD COLUMN IF NOT EXISTS "progressPercentageSnapshot" INTEGER;

ALTER TABLE "public"."payment_attempts"
ADD COLUMN IF NOT EXISTS "progressPercentageSnapshot" INTEGER;
