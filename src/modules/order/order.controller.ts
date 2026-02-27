import { NextFunction, Request, Response } from "express";
import { CreateOrderDTO } from "./dto/createOrder.dto.js";
import { OrderService } from "./order.service.js";

export class OrderController {
  constructor(private orderService: OrderService) {}

  createCustomOrder = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as CreateOrderDTO;
      const result = await this.orderService.createCustomOrder(
        authUserId,
        body,
      );
      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };
}
