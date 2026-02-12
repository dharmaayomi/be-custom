import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { CreateAddressDTO } from "./dto/createAddress.dto.js";
import { EditAddressDTO } from "./dto/editAddress.dto.js";

export class UserService {
  constructor(
    private prisma: PrismaClient,
    private cloudinaryService: CloudinaryService,
  ) {}

  getUser = async (authUserId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      include: { addresses: { where: { deletedAt: null } } },
    });

    if (!user) {
      throw new ApiError("We couldn’t find your account", 404);
    }

    const { password, ...rest } = user;
    return { ...rest };
  };

  getUserDisplay = async (authUserId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
    });

    if (!user) {
      throw new ApiError("We couldn’t find your account", 404);
    }

    const { password, createdAt, updatedAt, phoneNumber, deletedAt, ...rest } =
      user;
    return { ...rest };
  };

  createAddress = async (authUserId: number, body: CreateAddressDTO) => {
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
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
    });

    if (!user) {
      throw new ApiError("We couldn’t find your account", 404);
    }

    const address = await this.prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new ApiError("We couldn’t find your address", 404);
    }
    if (address.userId !== authUserId) {
      throw new ApiError("You are not authorized to delete this address", 403);
    }

    const deletedAddress = await this.prisma.address.update({
      where: { id: addressId },
      data: { deletedAt: new Date() },
    });
    return { message: "Address deleted successfully" };
  };

  getAddresses = async (authUserId: number) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
    });

    if (!user) {
      throw new ApiError("We couldn’t find your account", 404);
    }

    const addresses = await this.prisma.address.findMany({
      where: { userId: authUserId, deletedAt: null },
    });
    return addresses;
  };
  getAddressById = async (authUserId: number, addressId: number) => {
    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId: authUserId,
        deletedAt: null,
      },
    });

    if (!address) {
      throw new ApiError("We couldn't find your address", 404);
    }

    return address;
  };

  updataProfile = async (authUserId: number) => {};
}
