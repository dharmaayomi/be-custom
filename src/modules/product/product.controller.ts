import { NextFunction, Request, Response } from "express";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import { CreateProductDTO } from "./dto/createProduct.dto.js";
import { ProductService } from "./product.service.js";

export class ProductController {
  constructor(
    private productService: ProductService,
    private cloudinaryService: CloudinaryService,
  ) {}

  createProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as CreateProductDTO;
      const result = await this.productService.createProduct(authUserId, body);
      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };

  getImageUploadSignature = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const result = this.cloudinaryService.getProductUploadSignature(
        authUserId,
        "image",
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getGlbUploadSignature = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const result = this.cloudinaryService.getProductUploadSignature(
        authUserId,
        "raw",
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
