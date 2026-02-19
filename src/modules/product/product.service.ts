import { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { PaginationService } from "../pagination/pagination.service.js";
import { CreateProductDTO } from "./dto/createProduct.dto.js";
import { EditProductDTO } from "./dto/editProduct.dto.js";
import { GetProductsQueryDTO } from "./dto/getProductsQuery.dto.js";

export class ProductService {
  private paginationService = new PaginationService();

  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
  ) {}

  private parseOptionalInt = (
    value: number | string | undefined,
    fieldName: string,
  ) => {
    if (value === undefined) return undefined;

    if (typeof value === "number") {
      if (!Number.isInteger(value) || value < 0) {
        throw new ApiError(
          `${fieldName} must be a valid non-negative integer`,
          400,
        );
      }
      return value;
    }

    const trimmed = value.trim();
    if (!trimmed) return undefined;

    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0) {
      throw new ApiError(
        `${fieldName} must be a valid non-negative integer`,
        400,
      );
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

    const {
      productName,
      sku,
      productUrl,
      description,
      basePrice,
      images,
      depth,
      height,
      width,
      weight,
    } = body;

    const normalizedProductName = productName.trim();
    const normalizedSku = sku.trim();
    const normalizedProductUrl = productUrl.trim();
    const normalizedDescription = description.trim();
    const normalizedWidth = this.parseOptionalInt(width, "width");
    const normalizedHeight = this.parseOptionalInt(height, "height");
    const normalizedDepth = this.parseOptionalInt(depth, "depth");
    const normalizedWeight = this.parseOptionalInt(weight, "weight");

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
        basePrice,
        width: normalizedWidth,
        height: normalizedHeight,
        depth: normalizedDepth,
        weight: normalizedWeight,
        images: normalizedImages,
        isActive: true,
        isCustomizable: true,
      },
    });
  };

  getProducts = async (query: GetProductsQueryDTO) => {
    const {
      page,
      perPage,
      sortBy,
      orderBy,
      isActive,
      isCustomizable,
      sku,
      name,
      dateFrom,
      dateTo,
      search,
    } = query;

    const skip = (page - 1) * perPage;

    const allowedSortBy = new Set([
      "id",
      "productName",
      "sku",
      "basePrice",
      "createdAt",
      "updatedAt",
    ]);

    const where: Prisma.ProductBaseWhereInput = {
      deletedAt: null,
    };

    if (typeof isActive === "boolean") {
      where.isActive = isActive;
    }

    if (typeof isCustomizable === "boolean") {
      where.isCustomizable = isCustomizable;
    }

    if (sku?.trim()) {
      where.sku = {
        contains: sku.trim(),
        mode: "insensitive",
      };
    }

    if (name?.trim()) {
      where.productName = {
        contains: name.trim(),
        mode: "insensitive",
      };
    }

    if (dateFrom || dateTo) {
      if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
        throw new ApiError("dateFrom cannot be greater than dateTo", 400);
      }

      where.createdAt = {
        ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
        ...(dateTo ? { lte: new Date(dateTo) } : {}),
      };
    }

    if (search?.trim()) {
      const normalizedSearch = search.trim();
      where.OR = [
        { productName: { contains: normalizedSearch, mode: "insensitive" } },
        { sku: { contains: normalizedSearch, mode: "insensitive" } },
      ];
    }

    const findManyArgs: Prisma.ProductBaseFindManyArgs = {
      where,
      skip,
      take: perPage,
      orderBy: {
        [sortBy]: orderBy,
      } as Prisma.ProductBaseOrderByWithRelationInput,
      select: {
        id: true,
        productName: true,
        sku: true,
        productUrl: true,
        description: true,
        basePrice: true,
        width: true,
        height: true,
        depth: true,
        weight: true,
        images: true,
        isActive: true,
        isCustomizable: true,
        createdAt: true,
        updatedAt: true,
      },
    };

    const [count, data] = await Promise.all([
      this.prisma.productBase.count({ where }),
      this.prisma.productBase.findMany(findManyArgs),
    ]);

    const meta = this.paginationService.generateMeta({
      page,
      perPage,
      count,
    });

    return {
      data,
      meta,
    };
  };

  getProductById = async (productId: string) => {
    const product = await this.prisma.productBase.findUnique({
      where: { id: productId },
    });

    if (!product || product.deletedAt) {
      throw new ApiError("Product not found", 404);
    }

    return product;
  };

  editProduct = async (
    authUserId: number,
    productId: string,
    body: EditProductDTO,
  ) => {
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

    const product = await this.prisma.productBase.findUnique({
      where: { id: productId },
    });

    if (!product || product.deletedAt) {
      throw new ApiError("Product not found", 404);
    }

    const hasField = (field: keyof EditProductDTO) =>
      Object.prototype.hasOwnProperty.call(body, field);

    const updateData: Prisma.ProductBaseUpdateInput = {};

    if (hasField("productName") && typeof body.productName === "string") {
      updateData.productName = body.productName.trim();
    }
    if (hasField("sku") && typeof body.sku === "string") {
      updateData.sku = body.sku.trim();
    }
    if (hasField("productUrl") && typeof body.productUrl === "string") {
      updateData.productUrl = body.productUrl.trim();
    }
    if (hasField("description") && typeof body.description === "string") {
      updateData.description = body.description.trim();
    }
    if (hasField("basePrice") && typeof body.basePrice !== "undefined") {
      updateData.basePrice = body.basePrice;
    }
    if (hasField("width") && typeof body.width !== "undefined") {
      updateData.width = this.parseOptionalInt(body.width, "width");
    }
    if (hasField("height") && typeof body.height !== "undefined") {
      updateData.height = this.parseOptionalInt(body.height, "height");
    }
    if (hasField("depth") && typeof body.depth !== "undefined") {
      updateData.depth = this.parseOptionalInt(body.depth, "depth");
    }
    if (hasField("weight") && typeof body.weight !== "undefined") {
      updateData.weight = this.parseOptionalInt(body.weight, "weight");
    }
    if (hasField("images") && Array.isArray(body.images)) {
      const normalizedImages = body.images
        .map((image) => image.trim())
        .filter(Boolean);

      if (normalizedImages.length === 0) {
        throw new ApiError("images is required", 400);
      }

      updateData.images = normalizedImages;
    }

    if (
      typeof updateData.productUrl === "string" &&
      updateData.productUrl !== product.productUrl
    ) {
      try {
        await this.cloudinaryService.remove(product.productUrl, "raw");
      } catch (removeError) {
        // Keep edit flow running even if cleanup fails.
        console.error("Failed to remove old product file:", removeError);
      }
    }

    if (Array.isArray(updateData.images)) {
      const newImages = new Set(updateData.images);
      const oldImagesToRemove = product.images.filter(
        (imageUrl) => !newImages.has(imageUrl),
      );

      await Promise.all(
        oldImagesToRemove.map(async (imageUrl) => {
          try {
            await this.cloudinaryService.remove(imageUrl, "image");
          } catch (removeError) {
            // Keep edit flow running even if cleanup fails.
            console.error("Failed to remove old product image:", removeError);
          }
        }),
      );
    }

    if (Object.keys(updateData).length === 0) {
      return product;
    }

    return await this.prisma.productBase.update({
      where: { id: productId },
      data: updateData,
    });
  };

  deleteProduct = async (authUserId: number, productId: string) => {
    const [admin, product] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: authUserId },
        select: { role: true, deletedAt: true, accountStatus: true },
      }),
      this.prisma.productBase.findUnique({
        where: { id: productId },
        select: { id: true, deletedAt: true },
      }),
    ]);

    if (
      !admin ||
      admin.role !== "ADMIN" ||
      admin.deletedAt ||
      admin.accountStatus !== "ACTIVE"
    ) {
      throw new ApiError("You are not authorized to delete a product", 403);
    }

    if (!product || product.deletedAt) {
      throw new ApiError("Product not found", 404);
    }

    return await this.prisma.productBase.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });
  };
}
