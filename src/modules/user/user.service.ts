import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
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

  createAddress = async (authUserId: number, body: CreateAddressDTO) => {
    const user = await this.prisma.user.findFirst({
      where: {
        id: authUserId,
      },
      select: { id: true, accountStatus: true, deletedAt: true },
    });
    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }

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

      return await tx.address.create({
        data: {
          userId: authUserId,
          ...addressData,
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
