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
import { JwtMiddleware } from "./middlewares/jwt.middleware.js";
import { RoleMiddleware } from "./middlewares/role.middleware.js";
import { UploaderMiddleware } from "./middlewares/uploader.middleware.js";
import { ProductService } from "./modules/product/product.service.js";
import { ProductController } from "./modules/product/product.controller.js";
import { ProductRouter } from "./modules/product/product.router.js";
import { OrderService } from "./modules/order/order.service.js";
import { OrderController } from "./modules/order/order.controller.js";
import { OrderRouter } from "./modules/order/order.router.js";
import { PaymentService } from "./modules/payment/payment.service.js";
import { PaymentController } from "./modules/payment/payment.controller.js";
import { PaymentRouter } from "./modules/payment/payment.router.js";

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
    const userService = new UserService(prismaClient);
    const designService = new DesignService(prismaClient, cloudinaryService);
    const productService = new ProductService(prismaClient, cloudinaryService);
    const orderService = new OrderService(prismaClient);
    const paymentService = new PaymentService(prismaClient);

    // controllers
    const authController = new AuthController(authService);
    const userController = new UserController(userService, cloudinaryService);
    const designController = new DesignController(
      designService,
      cloudinaryService,
    );
    const productController = new ProductController(
      productService,
      cloudinaryService,
    );
    const orderController = new OrderController(orderService);
    const paymentController = new PaymentController(paymentService);

    // middlewares
    const validationMiddleware = new ValidationMiddleware();
    const jwtMiddleware = new JwtMiddleware();
    const roleMiddleware = new RoleMiddleware();
    const uploaderMiddleware = new UploaderMiddleware();

    // routers

    const authRouter = new AuthRouter(
      authController,
      validationMiddleware,
      jwtMiddleware,
    );
    const userRouter = new UserRouter(
      userController,
      validationMiddleware,
      jwtMiddleware,
      uploaderMiddleware,
    );
    const designRouter = new DesignRouter(
      designController,
      validationMiddleware,
      jwtMiddleware,
    );
    const productRouter = new ProductRouter(
      productController,
      validationMiddleware,
      jwtMiddleware,
      roleMiddleware,
    );
    const orderRouter = new OrderRouter(
      orderController,
      validationMiddleware,
      jwtMiddleware,
      roleMiddleware,
    );
    const paymentRouter = new PaymentRouter(
      paymentController,
      validationMiddleware,
      jwtMiddleware,
    );

    // routes
    // this.app.use("/samples", sampleRouter.getRouter());
    this.app.use("/auth", authRouter.getRouter());
    this.app.use("/user", userRouter.getRouter());
    this.app.use("/design", designRouter.getRouter());
    this.app.use("/product", productRouter.getRouter());
    this.app.use("/order", orderRouter.getRouter());
    this.app.use("/payment", paymentRouter.getRouter());
  }

  private handleError() {
    this.app.use(errorMiddleware);
  }

  public start() {
    this.app.listen(PORT, async () => {
      console.log(`Server running on port: ${PORT}`);
      try {
        // Memicu koneksi ke Supabase agar request pertama user tidak lambat
        await prisma.$connect();
        console.log("Database connection established and warmed up.");
      } catch (error) {
        console.error(
          "Failed to connect to the database during startup:",
          error,
        );
      }
    });
  }
}
