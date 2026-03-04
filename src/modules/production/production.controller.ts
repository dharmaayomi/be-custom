import { NextFunction, Request, Response } from "express";
import { CreateProductionProgressDTO } from "./dto/createProductionProgress.dto.js";
import { ProductionService } from "./production.service.js";

export class ProductionController {
  constructor(private productionService: ProductionService) {}

  createProductionProgress = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as CreateProductionProgressDTO;
      const result = await this.productionService.createProductionProgress(
        authUserId,
        body,
      );
      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };

  getProductionProgress = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const orderId = req.params.orderId;
      const result = await this.productionService.getProductionProgress(
        authUserId,
        orderId,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
