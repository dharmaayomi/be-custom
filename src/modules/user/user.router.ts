import { Router } from "express";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { UserController } from "./user.controller.js";

export class UserRouter {
  private router: Router;
  constructor(
    private userController: UserController,
    private validationMiddleware: ValidationMiddleware,
  ) {
    this.router = Router();
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get("/:id", this.userController.getUser);
    this.router.get("/display/:id", this.userController.getUserDisplay);
  };

  getRouter = () => {
    return this.router;
  };
}
