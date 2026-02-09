import crypto from "crypto";
import stableStringify from "json-stable-stringify";
import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { createSharableDesignDTO } from "./dto/createSharableDesign.dto.js";
import { addDays } from "date-fns";

export class DesignService {
  constructor(private prisma: PrismaClient) {}

  createSharableDesign = async (body: createSharableDesignDTO) => {
    const { configuration, designCode } = body;
    const serializedConfig = stableStringify(configuration);

    if (!serializedConfig) {
      throw new ApiError("Invalid configuration payload", 400);
    }
    const configHash = crypto
      .createHash("sha256")
      .update(serializedConfig)
      .digest("hex");

    const existing = await this.prisma.sharableDesign.findUnique({
      where: { configHash },
    });

    if (existing) return existing;
    return this.prisma.sharableDesign.create({
      data: {
        designCode,
        configHash,
        configuration,
        expiresAt: addDays(new Date(), 30),
      },
    });
  };

  getSharableDesignByCode = async (designCode: string) => {
    const design = await this.prisma.sharableDesign.findUnique({
      where: { designCode },
    });

    if (!design) {
      throw new ApiError("Design not found or expired", 404);
    }

    return design;
  };
}
