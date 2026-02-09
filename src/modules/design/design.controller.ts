import { NextFunction, Request, Response } from "express";
import { DesignService } from "./design.service.js";

export class DesignController {
  constructor(private designService: DesignService) {}

  createSharableDesign = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.designService.createSharableDesign(req.body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
