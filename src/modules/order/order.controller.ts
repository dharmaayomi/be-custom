import { NextFunction, Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { CreateOrderDTO } from "./dto/createOrder.dto.js";
import { GetOrdersQueryDTO } from "./dto/getOrdersQuery.dto.js";
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

  getOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const orderId = req.params.orderId;
      const result = await this.orderService.getOrder(authUserId, orderId);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const queryDto = plainToInstance(GetOrdersQueryDTO, req.query);
      const result = await this.orderService.getOrders(authUserId, queryDto);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
