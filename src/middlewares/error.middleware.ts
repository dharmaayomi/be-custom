import { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/api-error.js";

export const errorMiddleware = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  req.log.error(err.message);
  const message = err.message || "Something went wrong!";
  const status = err.status || 500;
  const payload: { message: string; code?: string } = { message };
  if (err.code) {
    payload.code = err.code;
  }
  res.status(status).send(payload);
};
