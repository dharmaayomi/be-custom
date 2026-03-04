-- Enforce one payment row per phase per order.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "payments_orderId_phase_key"
    ON "payments" ("orderId", "phase");
  END IF;
END $$;

-- Rename products table to productBases to align with ProductBase model mapping.
ALTER TABLE IF EXISTS "products" RENAME TO "productBases";


-- Derived money should not be persisted on order.
ALTER TABLE IF EXISTS "CustomOrder" DROP COLUMN IF EXISTS "totalAmountPaid";
ALTER TABLE IF EXISTS "CustomOrder" DROP COLUMN IF EXISTS "remainingAmount";

-- currentPaymentPhase should start as null.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'CustomOrder'
      AND column_name = 'currentPaymentPhase'
  ) THEN
    EXECUTE 'ALTER TABLE "CustomOrder" ALTER COLUMN "currentPaymentPhase" DROP DEFAULT';
  END IF;
END $$;

-- Support multiple progress photos in one entry.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'ProductionProgress'
  ) THEN
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ProductionProgress' AND column_name = 'photoUrl'
    ) THEN
      EXECUTE 'ALTER TABLE "ProductionProgress" RENAME COLUMN "photoUrl" TO "photoUrls"';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ProductionProgress' AND column_name = 'photoUrls'
    ) THEN
      EXECUTE 'ALTER TABLE "ProductionProgress" ALTER COLUMN "photoUrls" TYPE TEXT[] USING ARRAY["photoUrls"]';
    END IF;
  END IF;
END $$;
