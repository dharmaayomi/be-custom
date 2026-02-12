import { Router } from "express";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { UserController } from "./user.controller.js";
import { CreateAddressDTO } from "./dto/createAddress.dto.js";
import { EditAddressDTO } from "./dto/editAddress.dto.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";

export class UserRouter {
  private router: Router;
  constructor(
    private userController: UserController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get(
      "/:id",
      this.jwtMiddleware.verifyToken(),
      this.userController.getUser,
    );
    this.router.get(
      "/display/:id",
      this.jwtMiddleware.verifyToken(),
      this.userController.getUserDisplay,
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
  };

  getRouter = () => {
    return this.router;
  };
}
