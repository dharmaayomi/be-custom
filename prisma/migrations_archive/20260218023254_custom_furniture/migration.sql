-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING', 'DELETED');

-- CreateEnum
CREATE TYPE "ComponentCategory" AS ENUM ('SHELF', 'DRAWER', 'HANGER', 'DOOR', 'RAIL', 'ACCESSORY', 'HARDWARE');

-- CreateEnum
CREATE TYPE "DeliveryType" AS ENUM ('DELIVERY', 'PICKUP');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'PROCESSED', 'SHIPPED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
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
    "accountStatus" "AccountStatus" DEFAULT 'PENDING',
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "addresses" (
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
    "postalCode" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" SERIAL NOT NULL,
    "productName" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "productUrl" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "basePrice" DOUBLE PRECISION NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "depth" INTEGER,
    "weight" INTEGER,
    "images" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCustomizable" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productComponents" (
    "id" SERIAL NOT NULL,
    "componentName" TEXT NOT NULL,
    "componentUrl" TEXT NOT NULL,
    "category" "ComponentCategory" NOT NULL,
    "componentDesc" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "weight" INTEGER NOT NULL,
    "componentImageUrls" TEXT[],
    "isActive" BOOLEAN NOT NULL,

    CONSTRAINT "productComponents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "productMaterials" (
    "id" SERIAL NOT NULL,
    "materialName" TEXT NOT NULL,
    "materialUrl" TEXT NOT NULL,
    "materialDesc" TEXT NOT NULL,
    "meterialImageUrls" TEXT[],
    "isActive" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "productMaterials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "userDesigns" (
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
CREATE TABLE "CustomOrder" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "userDesignId" INTEGER NOT NULL,
    "snapShotAddress" JSONB NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "subtotalPrice" DOUBLE PRECISION,
    "deliveryType" "DeliveryType" NOT NULL DEFAULT 'DELIVERY',
    "deliveryDistancce" DOUBLE PRECISION,
    "deliveryFee" DOUBLE PRECISION,
    "trackNumber" TEXT,
    "totalWeight" DOUBLE PRECISION,
    "grandTotalPrice" DOUBLE PRECISION NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "addressId" INTEGER,

    CONSTRAINT "CustomOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrderItem" (
    "id" SERIAL NOT NULL,
    "customOrderId" INTEGER NOT NULL,
    "productBaseId" INTEGER NOT NULL,
    "materialId" INTEGER,
    "lockedBasePrice" DOUBLE PRECISION NOT NULL,
    "lockedMaterialPrice" DOUBLE PRECISION NOT NULL,
    "itemTotalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CustomOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomOrderComponent" (
    "id" SERIAL NOT NULL,
    "customOrderItemId" INTEGER NOT NULL,
    "componentId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "lockedPricePerUnit" DOUBLE PRECISION NOT NULL,
    "lockedSubTotal" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "CustomOrderComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShareableDesign" (
    "id" SERIAL NOT NULL,
    "designCode" TEXT NOT NULL,
    "configHash" TEXT NOT NULL,
    "configuration" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3),

    CONSTRAINT "ShareableDesign_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_userName_key" ON "users"("userName");

-- CreateIndex
CREATE INDEX "addresses_userId_isDefault_idx" ON "addresses"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "userDesigns_userId_deletedAt_idx" ON "userDesigns"("userId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "userDesigns_userId_designName_key" ON "userDesigns"("userId", "designName");

-- CreateIndex
CREATE UNIQUE INDEX "userDesigns_userId_designCode_key" ON "userDesigns"("userId", "designCode");

-- CreateIndex
CREATE UNIQUE INDEX "ShareableDesign_designCode_key" ON "ShareableDesign"("designCode");

-- CreateIndex
CREATE UNIQUE INDEX "ShareableDesign_configHash_key" ON "ShareableDesign"("configHash");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "userDesigns" ADD CONSTRAINT "userDesigns_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_userDesignId_fkey" FOREIGN KEY ("userDesignId") REFERENCES "userDesigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrder" ADD CONSTRAINT "CustomOrder_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "addresses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_customOrderId_fkey" FOREIGN KEY ("customOrderId") REFERENCES "CustomOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_productBaseId_fkey" FOREIGN KEY ("productBaseId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderItem" ADD CONSTRAINT "CustomOrderItem_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "productMaterials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderComponent" ADD CONSTRAINT "CustomOrderComponent_customOrderItemId_fkey" FOREIGN KEY ("customOrderItemId") REFERENCES "CustomOrderItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomOrderComponent" ADD CONSTRAINT "CustomOrderComponent_componentId_fkey" FOREIGN KEY ("componentId") REFERENCES "productComponents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
