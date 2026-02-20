import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";
import { prisma } from "../lib/prisma.js";

export class RoleMiddleware {
  verifyRole(roles: string[]) {
    return async (req: Request, res: Response, next: NextFunction) => {
      const user = res.locals.user;

      if (!user?.id) {
        throw new ApiError(
          "Forbidden: You do not have access to this resource",
          403,
        );
      }

      const latestUser = await prisma.user.findUnique({
        where: { id: Number(user.id) },
        select: { role: true, accountStatus: true, deletedAt: true },
      });

      const allowedRoles = roles.map((role) => role.toUpperCase());
      const actualRole = latestUser?.role?.toUpperCase();

      if (
        !latestUser ||
        latestUser.deletedAt ||
        latestUser.accountStatus !== "ACTIVE" ||
        !actualRole ||
        !allowedRoles.includes(actualRole)
      ) {
        throw new ApiError(
          "Forbidden: You do not have access to this resource",
          403,
        );
      }

      next();
    };
  }
}
