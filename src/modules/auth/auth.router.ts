import { Router } from "express";
import { AuthController } from "./auth.controller.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";

export class AuthRouter {
  private readonly router: Router = Router();

  constructor(
    private authController: AuthController,
    private validationMiddleware: ValidationMiddleware,
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
  };

  getRouter(): Router {
    return this.router;
  }
}
