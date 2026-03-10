import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreateSnapPaymentDTO } from "./dto/createSnapPayment.dto.js";
import { GetPaymentsQueryDTO } from "./dto/getPaymentsQuery.dto.js";
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

    this.router.get(
      "/",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateQuery(GetPaymentsQueryDTO),
      this.paymentController.getPayments,
    );

    this.router.get(
      "/:paymentId/attempts",
      this.jwtMiddleware.verifyToken(),
      this.paymentController.getPaymentAttempts,
    );

    this.router.get(
      "/:attemptId/detail-attempt",
      this.jwtMiddleware.verifyToken(),
      this.paymentController.getPaymentAttempt,
    );

    this.router.get(
      "/:paymentId",
      this.jwtMiddleware.verifyToken(),
      this.paymentController.getPayment,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
