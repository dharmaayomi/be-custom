import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CreateProductDTO } from "./dto/createProduct.dto.js";

export class ProductService {
  constructor(private prisma: PrismaClient) {}

  private parseBasePrice = (value: string) => {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) {
      throw new ApiError("basePrice must be a valid non-negative number", 400);
    }
    return parsed;
  };

  createProduct = async (authUserId: number, body: CreateProductDTO) => {
    const admin = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: { role: true, deletedAt: true, accountStatus: true },
    });

    if (
      !admin ||
      admin.role !== "ADMIN" ||
      admin.deletedAt ||
      admin.accountStatus !== "ACTIVE"
    ) {
      throw new ApiError("You are not authorized to create a product", 403);
    }

    const { productName, sku, productUrl, description, basePrice, images } =
      body;

    const normalizedProductName = productName.trim();
    const normalizedSku = sku.trim();
    const normalizedProductUrl = productUrl.trim();
    const normalizedDescription = description.trim();
    const normalizedBasePrice = this.parseBasePrice(basePrice);
    const normalizedImages = images
      .map((image) => image.trim())
      .filter(Boolean);

    if (normalizedImages.length === 0) {
      throw new ApiError("images is required", 400);
    }

    const existingProduct = await this.prisma.productBase.findFirst({
      where: {
        OR: [{ sku: normalizedSku }, { productUrl: normalizedProductUrl }],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingProduct) {
      throw new ApiError("Product with same SKU or URL already exists", 409);
    }

    return await this.prisma.productBase.create({
      data: {
        productName: normalizedProductName,
        sku: normalizedSku,
        productUrl: normalizedProductUrl,
        description: normalizedDescription,
        basePrice: normalizedBasePrice,
        images: normalizedImages,
        isActive: true,
        isCustomizable: true,
      },
    });
  };
}
