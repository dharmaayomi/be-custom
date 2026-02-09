import { NextFunction, Request, Response } from "express";
import { AuthService } from "./auth.service.js";
import { LoginDTO } from "./dto/login.dto.js";
import { RegisterDTO } from "./dto/register.dto.js";

export class AuthController {
  // Menggunakan manual injection melalui constructor
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
}
