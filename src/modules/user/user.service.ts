import { PrismaClient } from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";

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

  createAddress = async (body: any) => {};

  updateAddress = async (body: any) => {};

  deleteAddress = async (body: any) => {};

  getAddresses = async (body: any) => {};

  saveUserDesign = async (userId: string, design: any) => {};
}
