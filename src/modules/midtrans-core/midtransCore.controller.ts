import { NextFunction, Request, Response } from "express";
import { MidtransCoreService } from "./midtransCore.service.js";
import { ChargeCoreApiDTO } from "./dto/chargeCoreApi.dto.js";
import { MidtransCoreWebhookDTO } from "./dto/midtransCoreWebhook.dto.js";

export class MidtransCoreController {
  constructor(private midtransCoreService: MidtransCoreService) {}

  charge = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ChargeCoreApiDTO;
      const result = await this.midtransCoreService.charge(body);
      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };

  getStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await this.midtransCoreService.getStatus(
        req.params.orderId,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  webhook = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as MidtransCoreWebhookDTO;
      const result = await this.midtransCoreService.handleWebhook(body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
