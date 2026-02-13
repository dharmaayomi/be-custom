import { NextFunction, Request, Response } from "express";
import { UserService } from "./user.service.js";
import { CreateAddressDTO } from "./dto/createAddress.dto.js";
import { EditAddressDTO } from "./dto/editAddress.dto.js";
import { UpdateProfileDTO } from "./dto/updateProfile.dto.js";
import { ApiError } from "../../utils/api-error.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";

export class UserController {
  constructor(
    private userService: UserService,
    private cloudinaryService: CloudinaryService,
  ) {}

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(req.params.id);
    const result = await this.userService.getUser(authUserId);
    res.status(200).send(result);
  };

  getUserDisplay = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.userService.getUserDisplay(authUserId);
    res.status(200).send(result);
  };

  createAddress = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const body = req.body as CreateAddressDTO;
    const result = await this.userService.createAddress(authUserId, body);
    res.status(200).send(result);
  };

  editAddress = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const addressId = Number(req.params.addressId);

    const body = req.body as EditAddressDTO;
    const result = await this.userService.editAddress(
      authUserId,
      body,
      addressId,
    );
    res.status(200).send(result);
  };

  deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const addressId = Number(req.params.addressId);
    const result = await this.userService.deleteAddress(authUserId, addressId);
    res.status(200).send(result);
  };

  getAddresses = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.userService.getAddresses(authUserId);
    res.status(200).send(result);
  };

  getAddressById = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const addressId = Number(req.params.addressId);
    const result = await this.userService.getAddressById(authUserId, addressId);
    res.status(200).send(result);
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const body = req.body as UpdateProfileDTO;
    const result = await this.userService.updateProfile(authUserId, body);
    res.status(200).send(result);
  };

  updateAvatar = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const file = req.file;
      if (!file) throw new ApiError("No file uploaded", 400);

      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/avif",
        "image/jpg",
        "image/webp",
      ];

      const maxFileSize = 5 * 1024 * 1024; // 5MB in bytes

      if (!allowedTypes.includes(file.mimetype)) {
        throw new ApiError("Invalid file type", 400);
      }

      if (file.size > maxFileSize) {
        throw new ApiError("File size is too large", 400);
      }
      const uploadResult = await this.cloudinaryService.upload(file);
      const avatarUrl = uploadResult.url;
      const result = await this.userService.updateAvatar(authUserId, avatarUrl);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
