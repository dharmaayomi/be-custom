import { NextFunction, Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { ApiError } from "../../utils/api-error.js";
import { PaginationQueryParams } from "../pagination/dto/pagination.dto.js";
import { NotificationService } from "./notification.service.js";

export class NotificationController {
  constructor(private notificationService: NotificationService) {}

  getNotifications = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const queryDto = plainToInstance(PaginationQueryParams, req.query);
      const result = await this.notificationService.getNotifications(
        authUserId,
        queryDto,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getUnreadCount = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const result = await this.notificationService.getUnreadCount(authUserId);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  markAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const notificationId = Number(req.params.notificationId);
      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        throw new ApiError("notificationId must be a positive integer", 400);
      }
      const result = await this.notificationService.markAsRead(
        authUserId,
        notificationId,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  markAllAsRead = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const result = await this.notificationService.markAllAsRead(authUserId);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  deleteNotification = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const notificationId = Number(req.params.notificationId);
      if (!Number.isInteger(notificationId) || notificationId <= 0) {
        throw new ApiError("notificationId must be a positive integer", 400);
      }
      const result = await this.notificationService.deleteNotification(
        authUserId,
        notificationId,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
