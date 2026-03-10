import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { ChargeCoreApiDTO } from "./dto/chargeCoreApi.dto.js";
import { MidtransCoreWebhookDTO } from "./dto/midtransCoreWebhook.dto.js";
import { MidtransCoreController } from "./midtransCore.controller.js";

export class MidtransCoreRouter {
  private router = Router();

  constructor(
    private midtransCoreController: MidtransCoreController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = () => {
    this.router.post(
      "/charge",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(ChargeCoreApiDTO),
      this.midtransCoreController.charge,
    );

    this.router.get(
      "/status/:orderId",
      this.jwtMiddleware.verifyToken(),
      this.midtransCoreController.getStatus,
    );

    this.router.post(
      "/webhook",
      this.validationMiddleware.validateBody(MidtransCoreWebhookDTO),
      this.midtransCoreController.webhook,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
