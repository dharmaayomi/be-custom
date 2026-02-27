import { PrismaClient } from "../../../generated/prisma/client.js";
import { RAJAONGKIR_API_COST_KEY } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import { CreateAddressDTO } from "./dto/createAddress.dto.js";
import { EditAddressDTO } from "./dto/editAddress.dto.js";
import { UpdateProfileDTO } from "./dto/updateProfile.dto.js";

export class UserService {
  constructor(private prisma: PrismaClient) {}

  getUser = async (authUserId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      include: { addresses: { where: { deletedAt: null } } },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }

    const { password, ...rest } = user;
    return { ...rest };
  };

  getUserDisplay = async (authUserId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        userName: true,
        role: true,
        avatar: true,
        accountStatus: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }

    return user;
  };

  private resolveKomerceSubdistrictId = async (
    subdistrict: string,
    city: string,
  ): Promise<string> => {
    if (!RAJAONGKIR_API_COST_KEY) {
      throw new ApiError("RajaOngkir cost key is not configured", 500);
    }

    const res = await fetch(
      `https://rajaongkir.komerce.id/api/v1/destination/domestic-destination?search=${encodeURIComponent(subdistrict)}&limit=50&offset=0`,
      {
        headers: { key: RAJAONGKIR_API_COST_KEY },
      },
    );

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      console.error("[Komerce] Failed to search subdistrict:", errBody);
      throw new ApiError("Failed to resolve subdistrict from Komerce", 502);
    }

    const payload = await res.json();
    const results: any[] = payload?.data ?? [];

    if (results.length === 0) {
      throw new ApiError(
        `Subdistrict "${subdistrict}" not found in Komerce`,
        400,
      );
    }

    // Match by subdistrict_name + city_name to avoid duplicates across cities
    const match = results.find(
      (d) =>
        d.subdistrict_name.toLowerCase() === subdistrict.toLowerCase() &&
        d.city_name.toLowerCase() === city.toLowerCase(),
    );

    // Fallback: match subdistrict_name only if city didn't match
    // (handles slight city name differences between wilayah.id & Komerce)
    const fallback = results.find(
      (d) => d.subdistrict_name.toLowerCase() === subdistrict.toLowerCase(),
    );

    const resolved = match ?? fallback;

    if (!resolved) {
      console.error(
        `[Komerce] No match for subdistrict="${subdistrict}" city="${city}". Available:`,
        results.map((d) => `${d.subdistrict_name}, ${d.city_name}`),
      );
      throw new ApiError(
        `Subdistrict "${subdistrict}" in "${city}" not found in Komerce — pastikan nama kecamatan sesuai`,
        400,
      );
    }

    return String(resolved.id ?? resolved.subdistrict_id);
  };

  createAddress = async (authUserId: number, body: CreateAddressDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { id: authUserId },
      select: { id: true, accountStatus: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }

    const { isDefault, ...addressData } = body;

    // Resolve Komerce subdistrict ID from subdistrict name + city name
    const komerceSubdistrictId = await this.resolveKomerceSubdistrictId(
      body.subdistrict,
      body.city,
    );

    return await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({
          where: {
            userId: authUserId,
            isDefault: true,
            deletedAt: null,
          },
          data: { isDefault: false },
        });
      }

      return await tx.address.create({
        data: {
          userId: authUserId,
          ...addressData,
          komerceSubdistrictId,
          isDefault,
        },
      });
    });
  };

  editAddress = async (
    authUserId: number,
    body: EditAddressDTO,
    addressId: number,
  ) => {
    const { isDefault, ...addressData } = body;

    return await this.prisma.$transaction(async (tx) => {
      if (isDefault) {
        await tx.address.updateMany({
          where: {
            userId: authUserId,
            isDefault: true,
            deletedAt: null,
          },
          data: { isDefault: false },
        });
      }

      const updated = await tx.address.updateMany({
        where: {
          id: addressId,
          userId: authUserId,
          deletedAt: null,
          user: {
            accountStatus: "ACTIVE",
            deletedAt: null,
          },
        },
        data: { ...addressData, isDefault },
      });

      if (updated.count === 0) {
        throw new ApiError("We couldn't find your address", 404);
      }

      return await tx.address.findUnique({
        where: { id: addressId },
      });
    });
  };

  deleteAddress = async (authUserId: number, addressId: number) => {
    const deletedAddress = await this.prisma.address.updateMany({
      where: {
        id: addressId,
        userId: authUserId,
        deletedAt: null,
        user: {
          accountStatus: "ACTIVE",
          deletedAt: null,
        },
      },
      data: { deletedAt: new Date() },
    });

    if (deletedAddress.count === 0) {
      throw new ApiError("We couldn't find your address", 404);
    }

    return { message: "Address deleted successfully" };
  };

  getAddresses = async (authUserId: number) => {
    const addresses = await this.prisma.address.findMany({
      where: {
        userId: authUserId,
        deletedAt: null,
        user: {
          accountStatus: "ACTIVE",
          deletedAt: null,
        },
      },
    });

    return addresses;
  };

  getAddressById = async (authUserId: number, addressId: number) => {
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId: authUserId,
        deletedAt: null,
        user: {
          accountStatus: "ACTIVE",
          deletedAt: null,
        },
      },
    });

    if (!address) {
      throw new ApiError("We couldn't find your address", 404);
    }

    return address;
  };

  updateProfile = async (authUserId: number, body: UpdateProfileDTO) => {
    const updatedUser = await this.prisma.user.updateMany({
      where: { id: authUserId, deletedAt: null, accountStatus: "ACTIVE" },
      data: {
        ...body,
      },
    });
    if (updatedUser.count === 0) {
      throw new ApiError("We couldn't find your account", 404);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
    });
    if (!user) {
      throw new ApiError("We couldn't find your account", 404);
    }
    return user;
  };

  updateAvatar = async (authuserId: number, avatarUrl: string) => {
    const updatedAvatar = await this.prisma.user.updateMany({
      where: { id: authuserId, deletedAt: null, accountStatus: "ACTIVE" },
      data: {
        avatar: avatarUrl,
      },
    });
    if (updatedAvatar.count === 0) {
      throw new ApiError("We couldn't find your account", 404);
    }

    const user = await this.prisma.user.findUnique({
      where: { id: authuserId },
    });
    if (!user) {
      throw new ApiError("We couldn't find your account", 404);
    }
    return user;
  };
}
