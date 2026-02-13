import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { ChangePasswordDTO } from "./dto/changePassword.dto.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { ForgotPasswordDTO } from "./dto/forgotPassword.dto.js";
import { ResetPasswordDTO } from "./dto/resetPassword.dto.js";

export class AuthRouter {
  private readonly router: Router = Router();

  constructor(
    private authController: AuthController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = (): void => {
    this.router.post(
      "/login",
      this.validationMiddleware.validateBody(LoginDTO),
      this.authController.login,
    );

    this.router.post(
      "/register",
      this.validationMiddleware.validateBody(RegisterDTO),
      this.authController.register,
    );

    this.router.patch(
      "/change-password",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(ChangePasswordDTO),
      this.authController.changePassword,
    );

    this.router.post(
      "/forgot-password",
      this.validationMiddleware.validateBody(ForgotPasswordDTO),
      this.authController.forgotPassword,
    );

    this.router.post(
      "/reset-password",
      this.validationMiddleware.validateBody(ResetPasswordDTO),
      this.authController.resetPassword,
    );
  };

  getRouter(): Router {
    return this.router;
  }
}
