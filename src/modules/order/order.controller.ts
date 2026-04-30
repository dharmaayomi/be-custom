import { NextFunction, Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { CreateOrderDTO } from "./dto/createOrder.dto.js";
import { GetAdminOrdersQueryDTO } from "./dto/getAdminOrdersQuery.dto.js";
import { GetOrdersQueryDTO } from "./dto/getOrdersQuery.dto.js";
import { GetEstimationFeeDto } from "./dto/getEstimationFee.dto.js";
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

  getAdminOrders = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryDto = plainToInstance(GetAdminOrdersQueryDTO, req.query);
      const result = await this.orderService.getAdminOrders(queryDto);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getAdminOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.orderId;
      const result = await this.orderService.getAdminOrder(orderId);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  startOrder = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const orderId = req.params.orderId;
      const result = await this.orderService.startOrder(orderId);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getDeliveryFeeEstimates = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as GetEstimationFeeDto;

      const result = await this.orderService.getDeliveryFeeEstimates(
        authUserId,
        body.addressId,
        body.configuration,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getOrderPaymentSummary = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const orderId = req.params.orderId;
      const result = await this.orderService.getOrderPaymentSummary(orderId);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
