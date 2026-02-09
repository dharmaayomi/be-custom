import { NextFunction, Request, Response } from "express";
import { UserService } from "./user.service.js";

export class UserController {
  constructor(private userService: UserService) {}

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(req.params.id);
    const result = await this.userService.getUser(authUserId);
    res.status(200).send(result);
  };

  getUserDisplay = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(req.params.id);
    const result = await this.userService.getUserDisplay(authUserId);
    res.status(200).send(result);
  };
}
