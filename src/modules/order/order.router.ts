import { Router } from "express";
import { OrderController } from "./order.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { RoleMiddleware } from "../../middlewares/role.middleware.js";
import { CreateOrderDTO } from "./dto/createOrder.dto.js";

export class OrderRouter {
  private router = Router();
  constructor(
    private orderController: OrderController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
    private roleMiddleware: RoleMiddleware,
  ) {
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get(
      "/",
      this.jwtMiddleware.verifyToken(),
      this.orderController.getOrders,
    );
    this.router.post(
      "/create-custom-order",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(CreateOrderDTO),
      this.orderController.createCustomOrder,
    );
    this.router.get(
      "/:orderId",
      this.jwtMiddleware.verifyToken(),
      this.orderController.getOrder,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
