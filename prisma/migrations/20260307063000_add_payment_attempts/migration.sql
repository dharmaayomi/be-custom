CREATE TABLE "public"."payment_attempts" (
  "id" TEXT NOT NULL,
  "paymentId" TEXT NOT NULL,
  "midtransOrderId" TEXT NOT NULL,
  "status" "public"."PaymentStatus" NOT NULL DEFAULT 'WAITING_FOR_PAYMENT',
  "paymentUrl" TEXT,
  "paymentType" TEXT,
  "midtransPaymentType" TEXT,
  "midtransBank" TEXT,
  "midtransReference" TEXT,
  "rawResponse" JSONB,
  "paidAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payment_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "payment_attempts_midtransOrderId_key"
ON "public"."payment_attempts" ("midtransOrderId");

CREATE INDEX "payment_attempts_paymentId_createdAt_idx"
ON "public"."payment_attempts" ("paymentId", "createdAt");

ALTER TABLE "public"."payment_attempts"
ADD CONSTRAINT "payment_attempts_paymentId_fkey"
FOREIGN KEY ("paymentId") REFERENCES "public"."payments"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
