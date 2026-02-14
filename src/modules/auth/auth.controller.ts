import { NextFunction, Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO, VerificationDTO } from "./dto/register.dto.js";
import { ChangePasswordDTO } from "./dto/changePassword.dto.js";
import { ForgotPasswordDTO } from "./dto/forgotPassword.dto.js";
import { ResetPasswordDTO } from "./dto/resetPassword.dto.js";
import { ApiError } from "../../utils/api-error.js";

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as LoginDTO;
      const result = await this.authService.login(body);

      res.status(200).send({
        status: "success",
        message: "Login successful",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as RegisterDTO;
      const result = await this.authService.register(body);

      res.status(201).send({
        status: "success",
        message: "User registered successfully",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  verifyEmailAndSetPassword = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as VerificationDTO;
      const result = await this.authService.verifyEmailAndSetPassword(
        authUserId,
        body,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as ChangePasswordDTO;
      const result = await this.authService.changePassword(authUserId, body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ForgotPasswordDTO;
      const result = await this.authService.forgotPassword(body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as ResetPasswordDTO;
      const resetPasswordToken = req.query.token as string;

      if (!resetPasswordToken) {
        throw new ApiError("No token provided", 401);
      }

      const result = await this.authService.resetPassword(
        body,
        resetPasswordToken,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
