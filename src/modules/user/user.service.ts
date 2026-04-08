import { PrismaClient } from "../../../generated/prisma/client.js";
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

  getUserPayments = async (authUserId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: {
        id: true,
        accountStatus: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }

    return this.prisma.payment.findMany({
      where: {
        order: {
          userId: authUserId,
          deletedAt: null,
        },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderId: true,
        phase: true,
        progressPercentageSnapshot: true,
        status: true,
        amount: true,
        paymentType: true,
        midtransPaymentType: true,
        midtransBank: true,
        midtransReference: true,
        paymentUrl: true,
        paidAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            grandTotalPrice: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });
  };

  getUserPaymentAttempts = async (authUserId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: {
        id: true,
        accountStatus: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }

    return this.prisma.paymentAttempt.findMany({
      where: {
        payment: {
          order: {
            userId: authUserId,
            deletedAt: null,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        payment: {
          select: {
            id: true,
            orderId: true,
            phase: true,
            progressPercentageSnapshot: true,
            amount: true,
            status: true,
            order: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                grandTotalPrice: true,
              },
            },
          },
        },
      },
    });
  };

  private normalizeJneCityCode = (value: string | null | undefined) => {
    const normalized = value?.trim();
    return normalized ? normalized : null;
  };

  createAddress = async (authUserId: number, body: CreateAddressDTO) => {
    const user = await this.prisma.user.findFirst({
      where: { id: authUserId },
      select: { id: true, accountStatus: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }

    const { isDefault, jneCityCode, ...addressData } = body;

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
          jneCityCode: this.normalizeJneCityCode(jneCityCode),
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
    const { isDefault, jneCityCode, ...addressData } = body;

    return await this.prisma.$transaction(async (tx) => {
      const existingAddress = await tx.address.findFirst({
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

      if (!existingAddress) {
        throw new ApiError("We couldn't find your address", 404);
      }

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

      const hasProvidedJneCityCode = Object.prototype.hasOwnProperty.call(
        body,
        "jneCityCode",
      );
      const shouldInvalidateJneCode =
        Object.prototype.hasOwnProperty.call(addressData, "district") ||
        Object.prototype.hasOwnProperty.call(addressData, "city") ||
        Object.prototype.hasOwnProperty.call(addressData, "subdistrict");

      const nextJneCityCode = hasProvidedJneCityCode
        ? this.normalizeJneCityCode(jneCityCode)
        : shouldInvalidateJneCode
          ? null
          : existingAddress.jneCityCode;

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
        data: { ...addressData, jneCityCode: nextJneCityCode, isDefault },
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
