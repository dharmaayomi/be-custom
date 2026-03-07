import { Router } from "express";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { RoleMiddleware } from "../../middlewares/role.middleware.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { CreateProductionProgressDTO } from "./dto/createProductionProgress.dto.js";
import { ProductionController } from "./production.controller.js";

export class ProductionRouter {
  private router = Router();

  constructor(
    private productionController: ProductionController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
    private roleMiddleware: RoleMiddleware,
  ) {
    this.initializeRoutes();
  }

  private initializeRoutes = () => {
    this.router.post(
      "/",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.validationMiddleware.validateBody(CreateProductionProgressDTO),
      this.productionController.createProductionProgress,
    );
    this.router.get(
      "/:orderId",
      this.jwtMiddleware.verifyToken(),
      this.productionController.getProductionProgress,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
