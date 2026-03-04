import { Router } from "express";
import { NotificationController } from "./notification.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { RoleMiddleware } from "../../middlewares/role.middleware.js";
import { PaginationQueryParams } from "../pagination/dto/pagination.dto.js";

export class NotificationRouter {
  private router = Router();
  constructor(
    private notificationController: NotificationController,
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
      this.validationMiddleware.validateQuery(PaginationQueryParams),
      this.notificationController.getNotifications,
    );
    this.router.get(
      "/unread-count",
      this.jwtMiddleware.verifyToken(),
      this.notificationController.getUnreadCount,
    );
    this.router.patch(
      "/:notificationId/read",
      this.jwtMiddleware.verifyToken(),
      this.notificationController.markAsRead,
    );
    this.router.patch(
      "/read-all",
      this.jwtMiddleware.verifyToken(),
      this.notificationController.markAllAsRead,
    );
    this.router.delete(
      "/:notificationId/delete",
      this.jwtMiddleware.verifyToken(),
      this.notificationController.deleteNotification,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
