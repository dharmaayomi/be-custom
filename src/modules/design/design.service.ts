import crypto from "crypto";
import stableStringify from "json-stable-stringify";
import { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { createSharableDesignDTO } from "./dto/createSharableDesign.dto.js";
import { addDays } from "date-fns";
import { customAlphabet } from "nanoid";
import { SaveDesignDTO } from "./dto/saveDesignDto.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { PaginationService } from "../pagination/pagination.service.js";
import { PaginationQueryParams } from "../pagination/dto/pagination.dto.js";

export class DesignService {
  private paginationService = new PaginationService();

  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
  ) {}

  private async generateUntitledName(userId: number) {
    const lastUntitled = await this.prisma.userDesign.findFirst({
      where: {
        userId,
        designName: {
          startsWith: "untitled-design-",
        },
        deletedAt: null,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        designName: true,
      },
    });

    if (!lastUntitled) {
      return "untitled-design-1";
    }

    const match = lastUntitled.designName.match(/untitled-design-(\d+)$/);
    const nextNumber = match ? Number(match[1]) + 1 : 1;

    return `untitled-design-${nextNumber}`;
  }

  generateSharableDesignCode = async (body: createSharableDesignDTO) => {
    const { configuration } = body;

    const serializedConfig = stableStringify(configuration);
    if (!serializedConfig) {
      throw new ApiError("Invalid configuration payload", 400);
    }

    const configHash = crypto
      .createHash("sha256")
      .update(serializedConfig)
      .digest("hex");

    const existing = await this.prisma.shareableDesign.findUnique({
      where: { configHash },
    });
    if (existing) return existing;

    const generateCode = customAlphabet(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      6,
    );

    for (let i = 0; i < 5; i++) {
      const code = generateCode();

      try {
        const result = await this.prisma.shareableDesign.create({
          data: {
            designCode: code,
            configHash,
            configuration,
            expiresAt: addDays(new Date(), 30),
          },
        });
        return result;
      } catch (e: any) {
        if (e.code !== "P2002") {
          throw e;
        }
      }
    }

    throw new ApiError("Failed to generate unique design code", 500);
  };

  getShareableDesign = async (designCode: string) => {
    const design = await this.prisma.shareableDesign.findUnique({
      where: { designCode, expiresAt: { gt: new Date() } },
    });

    if (!design) {
      throw new ApiError("Design not found or expired", 404);
    }

    return design;
  };

  saveDesign = async (authUserId: number, body: SaveDesignDTO) => {
    const existingUser = await this.prisma.user.findFirst({
      where: {
        id: authUserId,
      },
      select: { id: true, accountStatus: true, deletedAt: true },
    });
    if (
      !existingUser ||
      existingUser.deletedAt ||
      existingUser.accountStatus !== "ACTIVE"
    ) {
      throw new ApiError("We couldn't find your account", 404);
    }

    const { designCode, designName, configuration, previewUrl, fileFinalUrl } =
      body;

    const generateCode = customAlphabet(
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
      6,
    );

    const normalizedDesignCode =
      typeof designCode === "string" ? designCode.trim() : "";
    const finalDesignCode = normalizedDesignCode || generateCode();

    const existingDesign = await this.prisma.userDesign.findUnique({
      where: {
        userId_designCode: {
          userId: authUserId,
          designCode: finalDesignCode,
        },
      },
      select: { previewUrl: true },
    });

    const shouldReplacePreview =
      Boolean(previewUrl) &&
      Boolean(existingDesign?.previewUrl) &&
      existingDesign?.previewUrl !== previewUrl;
    let hasRemovedOldPreview = false;

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const finalDesignName =
          designName?.trim() || (await this.generateUntitledName(authUserId));

        if (shouldReplacePreview && !hasRemovedOldPreview) {
          try {
            await this.cloudinaryService.remove(existingDesign!.previewUrl!);
            hasRemovedOldPreview = true;
          } catch (removeError) {
            // Keep save flow running even if cleanup fails.
            console.error("Failed to remove old design preview:", removeError);
          }
        }

        return await this.prisma.userDesign.upsert({
          where: {
            userId_designCode: {
              userId: authUserId,
              designCode: finalDesignCode,
            },
          },
          update: {
            configuration,
            ...(designName ? { designName: finalDesignName } : {}),
            ...(previewUrl ? { previewUrl } : {}),
            ...(fileFinalUrl ? { fileFinalUrl } : {}),
            deletedAt: null,
          },
          create: {
            userId: authUserId,
            designCode: finalDesignCode,
            designName: finalDesignName,
            configuration,
            previewUrl,
            fileFinalUrl,
          },
        });
      } catch (e: any) {
        if (e.code !== "P2002") throw e;
      }
    }

    throw new ApiError("Failed to save design, please retry", 500);
  };

  getSavedDesigns = async (
    authUserId: number,
    query: PaginationQueryParams,
  ) => {
    const { page, perPage, sortBy, orderBy } = query;
    const skip = (page - 1) * perPage;

    const allowedSortBy = new Set([
      "id",
      "designName",
      "designCode",
      "createdAt",
      "updatedAt",
    ]);

    const finalSortBy = allowedSortBy.has(sortBy) ? sortBy : "updatedAt";

    const where: Prisma.UserDesignWhereInput = {
      userId: authUserId,
      deletedAt: null,
      user: {
        accountStatus: "ACTIVE",
        deletedAt: null,
      },
    };

    const [count, data] = await Promise.all([
      this.prisma.userDesign.count({ where }),
      this.prisma.userDesign.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          [finalSortBy]: orderBy,
        } as Prisma.UserDesignOrderByWithRelationInput,
      }),
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

  getSavedDesignByCode = async (authUserId: number, designCode: string) => {
    const savedDesign = await this.prisma.userDesign.findFirst({
      where: {
        userId: authUserId,
        designCode,
        deletedAt: null,
        user: {
          accountStatus: "ACTIVE",
          deletedAt: null,
        },
      },
    });
    if (!savedDesign) {
      throw new ApiError("We couldn’t find your design code", 404);
    }
    return savedDesign;
  };

  deleteDesign = async (authUserId: number, designCode: string) => {
    const deleted = await this.prisma.userDesign.updateMany({
      where: {
        userId: authUserId,
        designCode,
        deletedAt: null,
        user: {
          accountStatus: "ACTIVE",
          deletedAt: null,
        },
      },
      data: {
        deletedAt: new Date(),
      },
    });

    if (deleted.count === 0) {
      throw new ApiError("We couldn't find your design code", 404);
    }

    return { message: "Design deleted successfully" };
  };
}
