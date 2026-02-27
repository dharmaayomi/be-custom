import { NextFunction, Request, Response } from "express";
import { CreateSnapPaymentDTO } from "./dto/createSnapPayment.dto.js";
import { PaymentService } from "./payment.service.js";

export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  createSnapTransaction = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as CreateSnapPaymentDTO;

      const result = await this.paymentService.createSnapTransaction({
        authUserId,
        orderId: body.orderId,
        phase: body.phase,
      });

      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };

  handleMidtransWebhook = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.paymentService.handleMidtransWebhook(req.body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
