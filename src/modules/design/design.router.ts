import { Router } from "express";
import { DesignController } from "./design.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { SaveDesignDTO } from "./dto/saveDesignDto.js";

export class DesignRouter {
  private router: Router;
  constructor(
    private designController: DesignController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.post(
      "/create-shareable-code",
      this.designController.generateSharableDesignCode,
    );
    this.router.get(
      "/shareable-design/:designCode",
      this.designController.getShareableDesign,
    );
    this.router.post(
      "/save-design",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(SaveDesignDTO),
      this.designController.saveDesign,
    );
    this.router.get(
      "/saved-design/:designCode",
      this.jwtMiddleware.verifyToken(),
      this.designController.getSavedDesignByCode,
    );
    this.router.get(
      "/saved-designs",
      this.jwtMiddleware.verifyToken(),
      this.designController.getSavedDesigns,
    );
    this.router.delete(
      "/delete/:designCode",
      this.jwtMiddleware.verifyToken(),
      this.designController.deleteDesign,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
