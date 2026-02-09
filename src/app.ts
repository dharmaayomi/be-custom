import cors from "cors";
import express, { Express } from "express";
import "reflect-metadata";
import { PORT } from "./config/env.js";
import { loggerHttp } from "./lib/logger-http.js";
import { prisma } from "./lib/prisma.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { ValidationMiddleware } from "./middlewares/validation.middleware.js";
import { SampleController } from "./modules/sample/sample.controller.js";
import { SampleRouter } from "./modules/sample/sample.router.js";
import { SampleService } from "./modules/sample/sample.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import { AuthRouter } from "./modules/auth/auth.router.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { PasswordService } from "./modules/auth/password.service.js";
import { TokenService } from "./modules/auth/token.service.js";
import { MailService } from "./modules/mail/mail.service.js";
import { CloudinaryService } from "./modules/cloudinary/cloudinary.service.js";
import { UserRouter } from "./modules/user/user.router.js";
import { UserService } from "./modules/user/user.service.js";
import { UserController } from "./modules/user/user.controller.js";
import { DesignService } from "./modules/design/design.service.js";
import { DesignController } from "./modules/design/design.controller.js";
import { DesignRouter } from "./modules/design/design.router.js";

export class App {
  app: Express;

  constructor() {
    this.app = express();
    this.configure();
    this.registerModules();
    this.handleError();
  }

  private configure() {
    this.app.use(cors());
    this.app.use(loggerHttp);
    this.app.use(express.json());
  }

  private registerModules() {
    // shared dependency
    const prismaClient = prisma;

    // services
    const sampleService = new SampleService(prismaClient);
    const passwordService = new PasswordService();
    const tokenService = new TokenService();
    const mailService = new MailService();
    const authService = new AuthService(
      prismaClient,
      passwordService,
      tokenService,
      mailService,
    );
    const cloudinaryService = new CloudinaryService();
    const userService = new UserService(prismaClient, cloudinaryService);
    const designService = new DesignService(prismaClient);

    // controllers
    const sampleController = new SampleController(sampleService);
    const authController = new AuthController(authService);
    const userController = new UserController(userService);
    const designController = new DesignController(designService);

    // middlewares
    const validationMiddleware = new ValidationMiddleware();

    // routers
    const sampleRouter = new SampleRouter(
      sampleController,
      validationMiddleware,
    );
    const authRouter = new AuthRouter(authController, validationMiddleware);
    const userRouter = new UserRouter(userController, validationMiddleware);
    const designRouter = new DesignRouter(
      designController,
      validationMiddleware,
    );

    // routes
    // this.app.use("/samples", sampleRouter.getRouter());
    this.app.use("/auth", authRouter.getRouter());
    this.app.use("/user", userRouter.getRouter());
    this.app.use("/design", designRouter.getRouter());
  }

  private handleError() {
    this.app.use(errorMiddleware);
  }

  public start() {
    this.app.listen(PORT, () => {
      console.log(`Server running on port: ${PORT}`);
    });
  }
}
