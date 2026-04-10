import { Router } from "express";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { UserController } from "./user.controller.js";
import { CreateAddressDTO } from "./dto/createAddress.dto.js";
import { EditAddressDTO } from "./dto/editAddress.dto.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { UpdateProfileDTO } from "./dto/updateProfile.dto.js";
import { UploaderMiddleware } from "../../middlewares/uploader.middleware.js";

export class UserRouter {
  private router: Router;
  constructor(
    private userController: UserController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
    private uploaderMiddleware: UploaderMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get(
      "/",
      this.jwtMiddleware.verifyToken(),
      this.userController.getUser,
    );

    this.router.get(
      "/display",
      this.jwtMiddleware.verifyToken(),
      this.userController.getUserDisplay,
    );
    this.router.get(
      "/jne-destinations",
      this.userController.getJNEDestinations,
    );

    this.router.get(
      "/jne-destinations/provinces",
      this.userController.getProvinces,
    );
    this.router.get("/jne-destinations/cities", this.userController.getCities);
    this.router.get(
      "/jne-destinations/districts",
      this.userController.getDistricts,
    );
    this.router.get(
      "/jne-destinations/subdistricts",
      this.userController.getSubdistricts,
    );
    this.router.get(
      "/:id/payments",
      this.jwtMiddleware.verifyToken(),
      this.userController.getUserPayments,
    );
    this.router.get(
      "/payment-attempts",
      this.jwtMiddleware.verifyToken(),
      this.userController.getUserPaymentAttempts,
    );
    this.router.get(
      "/:id/address",
      this.jwtMiddleware.verifyToken(),
      this.userController.getAddresses,
    );
    this.router.get(
      "/:id/address/:addressId",
      this.jwtMiddleware.verifyToken(),
      this.userController.getAddressById,
    );
    this.router.post(
      "/:id/address",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(CreateAddressDTO),
      this.userController.createAddress,
    );
    this.router.patch(
      "/:id/address/:addressId",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(EditAddressDTO),
      this.userController.editAddress,
    );
    this.router.delete(
      "/:id/address/:addressId",
      this.jwtMiddleware.verifyToken(),
      this.userController.deleteAddress,
    );
    this.router.patch(
      "/profile",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(UpdateProfileDTO),
      this.userController.updateProfile,
    );
    this.router.post(
      "/avatar/:id",
      this.jwtMiddleware.verifyToken(),
      this.uploaderMiddleware.uploader().single("avatarUrl"),
      this.uploaderMiddleware.fileFilter,
      this.userController.updateAvatar,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
