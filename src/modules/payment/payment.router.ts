import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreateSnapPaymentDTO } from "./dto/createSnapPayment.dto.js";
import { PaymentController } from "./payment.controller.js";

export class PaymentRouter {
  private router = Router();

  constructor(
    private paymentController: PaymentController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = () => {
    this.router.post(
      "/midtrans/webhook",
      this.paymentController.handleMidtransWebhook,
    );

    this.router.post(
      "/create-snap",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(CreateSnapPaymentDTO),
      this.paymentController.createSnapTransaction,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
