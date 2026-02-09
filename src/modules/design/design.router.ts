import { Router } from "express";
import { DesignController } from "./design.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";

export class DesignRouter {
  private router: Router;
  constructor(
    private designController: DesignController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.post(
      "/create-sharable-design",
      this.designController.createSharableDesign,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
