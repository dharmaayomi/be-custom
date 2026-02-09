import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";

export class RoleMiddleware {
  verifyRole(roles: string[]) {
    return (req: Request, res: Response, next: NextFunction) => {
      const user = res.locals.user;

      if (!user || !user.role || !roles.includes(user.role)) {
        throw new ApiError(
          "Forbidden: You do not have access to this resource",
          403,
        );
      }

      next();
    };
  }
}
