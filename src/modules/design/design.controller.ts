import { NextFunction, Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { DesignService } from "./design.service.js";
import { SaveDesignDTO } from "./dto/saveDesignDto.js";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { PaginationQueryParams } from "../pagination/dto/pagination.dto.js";

export class DesignController {
  constructor(
    private designService: DesignService,
    private cloudinaryService: CloudinaryService,
  ) {}

  generateSharableDesignCode = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const result = await this.designService.generateSharableDesignCode(
        req.body,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getShareableDesign = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    const result = await this.designService.getShareableDesign(
      req.params.designCode,
    );
    res.status(200).send(result);
  };

  saveDesign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = res.locals.user.id;
      const body = req.body as SaveDesignDTO;
      const result = await this.designService.saveDesign(authUserId, body);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getDesignPreviewUploadSignature = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const result =
        this.cloudinaryService.getDesignPreviewUploadSignature(authUserId);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getSavedDesigns = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = res.locals.user.id;
      const queryDto = plainToInstance(PaginationQueryParams, req.query);
      const result = await this.designService.getSavedDesigns(
        authUserId,
        queryDto,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getSavedDesignByCode = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = res.locals.user.id;
      const designCode = req.params.designCode;
      const result = await this.designService.getSavedDesignByCode(
        authUserId,
        designCode,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  deleteDesign = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = res.locals.user.id;
      const designCode = req.params.designCode;
      const result = await this.designService.deleteDesign(
        authUserId,
        designCode,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
