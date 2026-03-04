-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "public"."AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."ComponentCategory" AS ENUM ('SHELF', 'DRAWER', 'HANGER', 'DOOR', 'RAIL', 'ACCESSORY', 'HARDWARE');

-- CreateEnum
CREATE TYPE "public"."DeliveryType" AS ENUM ('DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "public"."MaterialCategory" AS ENUM ('FLOOR', 'WALL', 'FURNITURE');

-- CreateEnum
CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING_PAYMENT', 'IN_PRODUCTION', 'READY_TO_SHIP', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'AWAITING_PRODUCTION');

-- CreateEnum
CREATE TYPE "public"."PaymentPhase" AS ENUM ('DP', 'PROGRESS_1', 'PROGRESS_2', 'FINAL');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('WAITING_FOR_PAYMENT', 'PAID', 'FAILED', 'EXPIRED', 'CHALLENGE', 'DENIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."Provider" AS ENUM ('GOOGLE', 'CREDENTIAL');

-- CreateEnum
CREATE TYPE "public"."Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "public"."CustomOrder" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "userDesignId" INTEGER,
    "snapShotAddress" JSONB NOT NULL,
    "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotalPrice" DOUBLE PRECISION NOT NULL,
    "deliveryType" "public"."DeliveryType" NOT NULL DEFAULT 'DELIVERY',
    "deliveryFee" DOUBLE PRECISION,
    "trackNumber" TEXT,
    "totalWeight" DOUBLE PRECISION NOT NULL,
    "grandTotalPrice" DOUBLE PRECISION NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "addressId" INTEGER,
    "deliveryDistance" DOUBLE PRECISION,
    "notes" TEXT,
    "designSnapShot" JSONB,
    "orderNumber" TEXT,
    "previewUrl" TEXT,
    "currentPaymentPhase" "public"."PaymentPhase",

    CONSTRAINT "CustomOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomOrderComponent" (
    "id" TEXT NOT NULL,
    "customOrderItemId" TEXT NOT NULL,
    "componentId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lockedPricePerUnit" DOUBLE PRECISION NOT NULL,
    "lockedSubTotal" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "CustomOrderComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomOrderItem" (
    "id" TEXT NOT NULL,
    "customOrderId" TEXT NOT NULL,
    "productBaseId" TEXT NOT NULL,
    "materialId" TEXT,
    "lockedBasePrice" DOUBLE PRECISION NOT NULL,
    "lockedMaterialPrice" DOUBLE PRECISION NOT NULL,
    "itemTotalPrice" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "CustomOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notification" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "role" "public"."Role" NOT NULL,
    "readByUserId" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "customOrderId" TEXT,
    "targetUserId" INTEGER,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProductionProgress" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "percentage" INTEGER NOT NULL,
    "photoUrl" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ShareableDesign" (
    "id" SERIAL NOT NULL,
    "designCode" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ShareableDesign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."addresses" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "phoneNumber" TEXT NOT NULL,
    "line1" TEXT NOT NULL,
    "line2" TEXT,
    "city" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "country" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "postalCode" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "cityCode" TEXT,
    "districtCode" TEXT,
    "provinceCode" TEXT,
    "subdistrict" TEXT,
    "subdistrictCode" TEXT,
    "komerceSubdistrictId" TEXT,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "phase" "public"."PaymentPhase" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'WAITING_FOR_PAYMENT',
    "externalId" TEXT,
    "paymentUrl" TEXT,
    "paidAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "paymentType" TEXT,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."productComponents" (
    "id" TEXT NOT NULL,
    "componentName" TEXT NOT NULL,
    "componentUrl" TEXT NOT NULL,
    "componentDesc" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "weight" INTEGER NOT NULL,
    "componentImageUrls" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "componentCategory" "public"."ComponentCategory",
    "createdAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),
    "componentSku" TEXT,

    CONSTRAINT "productComponents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."productMaterials" (
    "id" TEXT NOT NULL,
    "materialName" TEXT NOT NULL,
    "materialUrl" TEXT NOT NULL,
    "materialDesc" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "price" INTEGER,
    "materialSku" TEXT,
    "materialCategories" "public"."MaterialCategory"[],

    CONSTRAINT "productMaterials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "weight" INTEGER NOT NULL,
    "images" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCustomizable" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."samples" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."userDesigns" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "designCode" TEXT NOT NULL,
    "designName" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "previewUrl" TEXT,
    "fileFinalUrl" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "userDesigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "public"."Role" NOT NULL DEFAULT 'USER',
    "userName" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "avatar" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordTokenUsed" BOOLEAN,
    "emailVerificationToken" TEXT,
    "emailVerificationUsed" BOOLEAN,
    "verificationSentAt" TIMESTAMP(3),
    "deleteAccountToken" TEXT,
    "deletedAccountTokenUsed" BOOLEAN,
    "deletionRequestSentAt" TIMESTAMP(3),
    "accountStatus" "public"."AccountStatus" DEFAULT 'PENDING',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomOrder_orderNumber_key" ON "public"."CustomOrder"("orderNumber" ASC);

-- CreateIndex
CREATE INDEX "Notification_role_targetUserId_createdAt_idx" ON "public"."Notification"("role" ASC, "targetUserId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ShareableDesign_configHash_key" ON "public"."ShareableDesign"("configHash" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "ShareableDesign_designCode_key" ON "public"."ShareableDesign"("designCode" ASC);

-- CreateIndex
CREATE INDEX "addresses_userId_isDefault_idx" ON "public"."addresses"("userId" ASC, "isDefault" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "payments_orderId_phase_key" ON "public"."payments"("orderId" ASC, "phase" ASC);

-- CreateIndex
CREATE INDEX "userDesigns_userId_deletedAt_idx" ON "public"."userDesigns"("userId" ASC, "deletedAt" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "userDesigns_userId_designCode_key" ON "public"."userDesigns"("userId" ASC, "designCode" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "userDesigns_userId_designName_key" ON "public"."userDesigns"("userId" ASC, "designName" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "users_userName_key" ON "public"."users"("userName" ASC);

-- AddForeignKey
ALTER TABLE "public"."CustomOrder" ADD CONSTRAINT "CustomOrder_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "public"."addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomOrder" ADD CONSTRAINT "CustomOrder_userDesignId_fkey" FOREIGN KEY ("userDesignId") REFERENCES "public"."userDesigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomOrder" ADD CONSTRAINT "CustomOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomOrderComponent" ADD CONSTRAINT "CustomOrderComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "public"."productComponents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomOrderComponent" ADD CONSTRAINT "CustomOrderComponent_customOrderItemId_fkey" FOREIGN KEY ("customOrderItemId") REFERENCES "public"."CustomOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "public"."CustomOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "public"."productMaterials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_productBaseId_fkey" FOREIGN KEY ("productBaseId") REFERENCES "public"."products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "public"."CustomOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notification" ADD CONSTRAINT "Notification_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ProductionProgress" ADD CONSTRAINT "ProductionProgress_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."CustomOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "public"."CustomOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."userDesigns" ADD CONSTRAINT "userDesigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
