import { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { PaginationService } from "../pagination/pagination.service.js";
import {
  CreateComponentDTO,
  CreateMaterialDTO,
  CreateProductDTO,
} from "./dto/createProduct.dto.js";
import {
  EditComponentDTO,
  EditMaterialDTO,
  EditProductDTO,
} from "./dto/editProduct.dto.js";
import { GetComponentsQueryDTO } from "./dto/getComponentsQuery.dto.js";
import { GetMaterialsQueryDTO } from "./dto/getMaterialsQuery.dto.js";
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

  createProduct = async (_authUserId: number, body: CreateProductDTO) => {
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

    if (typeof normalizedWidth === "undefined") {
      throw new ApiError("width is required", 400);
    }
    if (typeof normalizedHeight === "undefined") {
      throw new ApiError("height is required", 400);
    }
    if (typeof normalizedDepth === "undefined") {
      throw new ApiError("depth is required", 400);
    }
    if (typeof normalizedWeight === "undefined") {
      throw new ApiError("weight is required", 400);
    }

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
    _authUserId: number,
    productId: string,
    body: EditProductDTO,
  ) => {
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
    if (hasField("isActive") && typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }
    if (
      hasField("isCustomizable") &&
      typeof body.isCustomizable === "boolean"
    ) {
      updateData.isCustomizable = body.isCustomizable;
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

  deleteProduct = async (_authUserId: number, productId: string) => {
    const product = await this.prisma.productBase.findUnique({
      where: { id: productId },
      select: { id: true, deletedAt: true },
    });

    if (!product || product.deletedAt) {
      throw new ApiError("Product not found", 404);
    }

    return await this.prisma.productBase.update({
      where: { id: productId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });
  };

  createComponent = async (_authUserId: number, body: CreateComponentDTO) => {
    const {
      componentName,
      componentSku,
      componentUrl,
      componentDesc,
      componentCategory,
      price,
      weight,
      componentImageUrls,
    } = body;

    const normalizedComponentName = componentName.trim();
    const normalizedComponentSku = componentSku.trim();
    const normalizedComponentUrl = componentUrl.trim();
    const normalizedComponentDesc = componentDesc.trim();
    const normalizedWeight = this.parseOptionalInt(weight, "weight");

    if (typeof normalizedWeight === "undefined") {
      throw new ApiError("weight is required", 400);
    }

    const normalizedImageUrls = componentImageUrls
      .map((image) => image.trim())
      .filter(Boolean);

    if (normalizedImageUrls.length === 0) {
      throw new ApiError("componentImageUrls is required", 400);
    }

    const existingComponent = await this.prisma.productComponent.findFirst({
      where: {
        OR: [
          { componentName: normalizedComponentName },
          { componentSku: normalizedComponentSku },
          { componentUrl: normalizedComponentUrl },
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingComponent) {
      throw new ApiError(
        "Component with same name, SKU, or URL already exists",
        409,
      );
    }

    return await this.prisma.productComponent.create({
      data: {
        componentName: normalizedComponentName,
        componentSku: normalizedComponentSku,
        componentUrl: normalizedComponentUrl,
        componentDesc: normalizedComponentDesc,
        componentCategory,
        price,
        weight: normalizedWeight,
        componentImageUrls: normalizedImageUrls,
        isActive: true,
      },
    });
  };

  getComponents = async (query: GetComponentsQueryDTO) => {
    const {
      page,
      perPage,
      sortBy,
      orderBy,
      isActive,
      componentCategory,
      category,
      name,
      search,
    } = query;

    const skip = (page - 1) * perPage;
    const allowedSortBy = new Set([
      "id",
      "componentName",
      "componentUrl",
      "componentCategory",
      "componentDesc",
      "price",
      "weight",
      "isActive",
      "deletedAt",
    ]);

    if (!allowedSortBy.has(sortBy)) {
      throw new ApiError("sortBy is not valid for components", 400);
    }

    const where: Prisma.ProductComponentWhereInput = {
      deletedAt: null,
    };

    if (typeof isActive === "boolean") {
      where.isActive = isActive;
    }

    const normalizedCategory = componentCategory ?? category;
    if (normalizedCategory) {
      where.componentCategory = normalizedCategory;
    }

    if (name?.trim()) {
      where.componentName = {
        contains: name.trim(),
        mode: "insensitive",
      };
    }

    if (search?.trim()) {
      const normalizedSearch = search.trim();
      where.OR = [
        { componentName: { contains: normalizedSearch, mode: "insensitive" } },
        { componentSku: { contains: normalizedSearch, mode: "insensitive" } },
        { componentDesc: { contains: normalizedSearch, mode: "insensitive" } },
      ];
    }

    const findManyArgs: Prisma.ProductComponentFindManyArgs = {
      where,
      skip,
      take: perPage,
      orderBy: {
        [sortBy]: orderBy,
      } as Prisma.ProductComponentOrderByWithRelationInput,
      select: {
        id: true,
        componentName: true,
        componentSku: true,
        componentUrl: true,
        componentCategory: true,
        componentDesc: true,
        price: true,
        weight: true,
        componentImageUrls: true,
        isActive: true,
      },
    };

    const [count, data] = await Promise.all([
      this.prisma.productComponent.count({ where }),
      this.prisma.productComponent.findMany(findManyArgs),
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

  getComponentById = async (componentId: string) => {
    const component = await this.prisma.productComponent.findUnique({
      where: { id: componentId },
    });

    if (!component || component.deletedAt) {
      throw new ApiError("Component not found", 404);
    }

    return component;
  };

  editComponent = async (
    _authUserId: number,
    componentId: string,
    body: EditComponentDTO,
  ) => {
    const component = await this.prisma.productComponent.findUnique({
      where: { id: componentId },
    });

    if (!component || component.deletedAt) {
      throw new ApiError("Component not found", 404);
    }

    const hasField = (field: keyof EditComponentDTO) =>
      Object.prototype.hasOwnProperty.call(body, field);

    const updateData: Prisma.ProductComponentUpdateInput = {};

    if (hasField("componentName") && typeof body.componentName === "string") {
      updateData.componentName = body.componentName.trim();
    }
    if (hasField("componentSku") && typeof body.componentSku === "string") {
      updateData.componentSku = body.componentSku.trim();
    }
    if (hasField("componentUrl") && typeof body.componentUrl === "string") {
      updateData.componentUrl = body.componentUrl.trim();
    }
    if (hasField("componentDesc") && typeof body.componentDesc === "string") {
      updateData.componentDesc = body.componentDesc.trim();
    }
    if (
      hasField("componentCategory") &&
      typeof body.componentCategory !== "undefined"
    ) {
      updateData.componentCategory = body.componentCategory;
    }
    if (hasField("price") && typeof body.price !== "undefined") {
      updateData.price = body.price;
    }
    if (hasField("weight") && typeof body.weight !== "undefined") {
      const normalizedWeight = this.parseOptionalInt(body.weight, "weight");
      if (typeof normalizedWeight === "undefined") {
        throw new ApiError("weight is required", 400);
      }
      updateData.weight = normalizedWeight;
    }
    if (
      hasField("componentImageUrls") &&
      Array.isArray(body.componentImageUrls)
    ) {
      const normalizedImageUrls = body.componentImageUrls
        .map((image) => image.trim())
        .filter(Boolean);

      if (normalizedImageUrls.length === 0) {
        throw new ApiError("componentImageUrls is required", 400);
      }

      updateData.componentImageUrls = normalizedImageUrls;
    }
    if (hasField("isActive") && typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }

    if (
      typeof updateData.componentName === "string" ||
      typeof updateData.componentSku === "string" ||
      typeof updateData.componentUrl === "string"
    ) {
      const existingComponent = await this.prisma.productComponent.findFirst({
        where: {
          deletedAt: null,
          id: { not: componentId },
          OR: [
            ...(typeof updateData.componentName === "string"
              ? [{ componentName: updateData.componentName }]
              : []),
            ...(typeof updateData.componentSku === "string"
              ? [{ componentSku: updateData.componentSku }]
              : []),
            ...(typeof updateData.componentUrl === "string"
              ? [{ componentUrl: updateData.componentUrl }]
              : []),
          ],
        },
        select: { id: true },
      });

      if (existingComponent) {
        throw new ApiError(
          "Component with same name, SKU, or URL already exists",
          409,
        );
      }
    }

    if (
      typeof updateData.componentUrl === "string" &&
      updateData.componentUrl !== component.componentUrl
    ) {
      try {
        await this.cloudinaryService.remove(component.componentUrl, "raw");
      } catch (removeError) {
        console.error("Failed to remove old component file:", removeError);
      }
    }

    if (Array.isArray(updateData.componentImageUrls)) {
      const newImages = new Set(updateData.componentImageUrls);
      const oldImagesToRemove = component.componentImageUrls.filter(
        (imageUrl) => !newImages.has(imageUrl),
      );

      await Promise.all(
        oldImagesToRemove.map(async (imageUrl) => {
          try {
            await this.cloudinaryService.remove(imageUrl, "image");
          } catch (removeError) {
            console.error("Failed to remove old component image:", removeError);
          }
        }),
      );
    }

    if (Object.keys(updateData).length === 0) {
      return component;
    }

    return await this.prisma.productComponent.update({
      where: { id: componentId },
      data: updateData,
    });
  };

  deleteComponent = async (_authUserId: number, componentId: string) => {
    const component = await this.prisma.productComponent.findUnique({
      where: { id: componentId },
      select: { id: true, deletedAt: true },
    });

    if (!component || component.deletedAt) {
      throw new ApiError("Component not found", 404);
    }

    return await this.prisma.productComponent.update({
      where: { id: componentId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });
  };

  createMaterial = async (_authUserId: number, body: CreateMaterialDTO) => {
    const {
      materialName,
      materialSku,
      materialUrl,
      materialDesc,
      materialCategories,
      price,
    } = body;

    const normalizedMaterialName = materialName.trim();
    const normalizedMaterialSku = materialSku?.trim() || undefined;
    const normalizedMaterialUrl = materialUrl.trim();
    const normalizedMaterialDesc = materialDesc.trim();
    const normalizedPrice = this.parseOptionalInt(price, "price");

    if (typeof normalizedPrice === "undefined") {
      throw new ApiError("price is required", 400);
    }

    const existingMaterial = await this.prisma.productMaterials.findFirst({
      where: {
        OR: [
          { materialName: normalizedMaterialName },
          ...(normalizedMaterialSku
            ? [{ materialSku: normalizedMaterialSku }]
            : []),
          { materialUrl: normalizedMaterialUrl },
        ],
        deletedAt: null,
      },
      select: { id: true },
    });

    if (existingMaterial) {
      throw new ApiError(
        "Material with same name, SKU, or URL already exists",
        409,
      );
    }

    return await this.prisma.productMaterials.create({
      data: {
        materialName: normalizedMaterialName,
        materialSku: normalizedMaterialSku,
        materialUrl: normalizedMaterialUrl,
        materialDesc: normalizedMaterialDesc,
        materialCategories,
        price: normalizedPrice,
        isActive: true,
      },
    });
  };

  getMaterials = async (query: GetMaterialsQueryDTO) => {
    const {
      page,
      perPage,
      sortBy,
      orderBy,
      isActive,
      materialCategories,
      name,
      dateFrom,
      dateTo,
      search,
    } = query;

    const skip = (page - 1) * perPage;

    const where: Prisma.ProductMaterialsWhereInput = {
      deletedAt: null,
    };

    if (typeof isActive === "boolean") {
      where.isActive = isActive;
    }

    if (materialCategories?.length) {
      where.materialCategories = {
        hasSome: materialCategories,
      };
    }

    if (name?.trim()) {
      where.materialName = {
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
        { materialName: { contains: normalizedSearch, mode: "insensitive" } },
        { materialSku: { contains: normalizedSearch, mode: "insensitive" } },
        { materialDesc: { contains: normalizedSearch, mode: "insensitive" } },
      ];
    }

    const findManyArgs: Prisma.ProductMaterialsFindManyArgs = {
      where,
      skip,
      take: perPage,
      orderBy: {
        [sortBy]: orderBy,
      } as Prisma.ProductMaterialsOrderByWithRelationInput,
      select: {
        id: true,
        materialName: true,
        materialSku: true,
        materialUrl: true,
        materialDesc: true,
        materialCategories: true,
        price: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    };

    const [count, data] = await Promise.all([
      this.prisma.productMaterials.count({ where }),
      this.prisma.productMaterials.findMany(findManyArgs),
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

  getMaterialById = async (materialId: string) => {
    const material = await this.prisma.productMaterials.findUnique({
      where: { id: materialId },
    });

    if (!material || material.deletedAt) {
      throw new ApiError("Material not found", 404);
    }

    return material;
  };

  editMaterial = async (
    _authUserId: number,
    materialId: string,
    body: EditMaterialDTO,
  ) => {
    const material = await this.prisma.productMaterials.findUnique({
      where: { id: materialId },
    });

    if (!material || material.deletedAt) {
      throw new ApiError("Material not found", 404);
    }

    const hasField = (field: keyof EditMaterialDTO) =>
      Object.prototype.hasOwnProperty.call(body, field);

    const updateData: Prisma.ProductMaterialsUpdateInput = {};

    if (hasField("materialName") && typeof body.materialName === "string") {
      updateData.materialName = body.materialName.trim();
    }
    if (hasField("materialSku") && typeof body.materialSku === "string") {
      updateData.materialSku = body.materialSku.trim();
    }
    if (hasField("materialUrl") && typeof body.materialUrl === "string") {
      updateData.materialUrl = body.materialUrl.trim();
    }
    if (hasField("materialDesc") && typeof body.materialDesc === "string") {
      updateData.materialDesc = body.materialDesc.trim();
    }
    if (
      hasField("materialCategories") &&
      typeof body.materialCategories !== "undefined"
    ) {
      updateData.materialCategories = body.materialCategories;
    }
    if (hasField("price") && typeof body.price !== "undefined") {
      const normalizedPrice = this.parseOptionalInt(body.price, "price");
      if (typeof normalizedPrice === "undefined") {
        throw new ApiError("price is required", 400);
      }
      updateData.price = normalizedPrice;
    }
    if (hasField("isActive") && typeof body.isActive === "boolean") {
      updateData.isActive = body.isActive;
    }

    if (
      typeof updateData.materialName === "string" ||
      typeof updateData.materialSku === "string" ||
      typeof updateData.materialUrl === "string"
    ) {
      const existingMaterial = await this.prisma.productMaterials.findFirst({
        where: {
          deletedAt: null,
          id: { not: materialId },
          OR: [
            ...(typeof updateData.materialName === "string"
              ? [{ materialName: updateData.materialName }]
              : []),
            ...(typeof updateData.materialSku === "string"
              ? [{ materialSku: updateData.materialSku }]
              : []),
            ...(typeof updateData.materialUrl === "string"
              ? [{ materialUrl: updateData.materialUrl }]
              : []),
          ],
        },
        select: { id: true },
      });

      if (existingMaterial) {
        throw new ApiError(
          "Material with same name, SKU, or URL already exists",
          409,
        );
      }
    }

    if (
      typeof updateData.materialUrl === "string" &&
      updateData.materialUrl !== material.materialUrl
    ) {
      try {
        await this.cloudinaryService.remove(material.materialUrl, "image");
      } catch (removeError) {
        // Keep edit flow running even if cleanup fails.
        console.error("Failed to remove old material file:", removeError);
      }
    }

    if (Object.keys(updateData).length === 0) {
      return material;
    }

    return await this.prisma.productMaterials.update({
      where: { id: materialId },
      data: updateData,
    });
  };

  deleteMaterial = async (_authUserId: number, materialId: string) => {
    const material = await this.prisma.productMaterials.findUnique({
      where: { id: materialId },
      select: { id: true, deletedAt: true },
    });

    if (!material || material.deletedAt) {
      throw new ApiError("Material not found", 404);
    }

    return await this.prisma.productMaterials.update({
      where: { id: materialId },
      data: { deletedAt: new Date() },
      select: { id: true, deletedAt: true },
    });
  };
}
