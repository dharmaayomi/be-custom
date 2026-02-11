import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env.js";
import { ApiError } from "../utils/api-error.js";

export interface JwtPayload {
  id: number;
  role: string;
}

export class JwtMiddleware {
  verifyToken() {
    return (req: Request, res: Response, next: NextFunction) => {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        throw new ApiError("No token provided", 401);
      }

      const [scheme, token] = authHeader.split(" ");

      if (scheme !== "Bearer" || !token) {
        throw new ApiError("Invalid token", 403);
      }

      try {
        const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
        res.locals.user = payload;
        next();
      } catch (err) {
        if (err instanceof jwt.TokenExpiredError) {
          throw new ApiError("Token expired", 403);
        }
        throw new ApiError("Invalid token", 403);
      }
    };
  }
}
