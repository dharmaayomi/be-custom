import { NextFunction, Request, Response } from "express";
import { UserService } from "./user.service.js";
import { CreateAddressDTO } from "./dto/createAddress.dto.js";
import { EditAddressDTO } from "./dto/editAddress.dto.js";

export class UserController {
  constructor(private userService: UserService) {}

  getUser = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(req.params.id);
    const result = await this.userService.getUser(authUserId);
    res.status(200).send(result);
  };

  getUserDisplay = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.userService.getUserDisplay(authUserId);
    res.status(200).send(result);
  };

  createAddress = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const body = req.body as CreateAddressDTO;
    const result = await this.userService.createAddress(authUserId, body);
    res.status(200).send(result);
  };

  editAddress = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const addressId = Number(req.params.addressId);

    const body = req.body as EditAddressDTO;
    const result = await this.userService.editAddress(
      authUserId,
      body,
      addressId,
    );
    res.status(200).send(result);
  };

  deleteAddress = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const addressId = Number(req.params.addressId);
    const result = await this.userService.deleteAddress(authUserId, addressId);
    res.status(200).send(result);
  };

  getAddresses = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const result = await this.userService.getAddresses(authUserId);
    res.status(200).send(result);
  };

  getAddressById = async (req: Request, res: Response, next: NextFunction) => {
    const authUserId = Number(res.locals.user.id);
    const addressId = Number(req.params.addressId);
    const result = await this.userService.getAddressById(authUserId, addressId);
    res.status(200).send(result);
  };
}
