import { NextFunction, Request, Response } from "express";
import { plainToInstance } from "class-transformer";
import { CloudinaryService } from "../cloudinary/cloudinary.service.js";
import {
  CreateComponentDTO,
  CreateMaterialDTO,
  CreateProductDTO,
} from "./dto/createProduct.dto.js";
import {
  EditComponentDTO,
  EditMaterialDTO,
  EditProductDTO,
} from "./dto/editProduct.dto.js";
import { GetProductsQueryDTO } from "./dto/getProductsQuery.dto.js";
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

  getProducts = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const queryDto = plainToInstance(GetProductsQueryDTO, req.query);
      const result = await this.productService.getProducts(queryDto);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  getProductById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const productId = req.params.id;
      const result = await this.productService.getProductById(productId);
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  editProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const productId = req.params.id;
      const body = req.body as EditProductDTO;
      const result = await this.productService.editProduct(
        authUserId,
        productId,
        body,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const productId = req.params.id;
      const result = await this.productService.deleteProduct(
        authUserId,
        productId,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  createComponent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as CreateComponentDTO;
      const result = await this.productService.createComponent(
        authUserId,
        body,
      );
      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };

  editComponent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const componentId = req.params.id;
      const body = req.body as EditComponentDTO;
      const result = await this.productService.editComponent(
        authUserId,
        componentId,
        body,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  deleteComponent = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const componentId = req.params.id;
      const result = await this.productService.deleteComponent(
        authUserId,
        componentId,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  createMaterial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const body = req.body as CreateMaterialDTO;
      const result = await this.productService.createMaterial(authUserId, body);
      res.status(201).send(result);
    } catch (error) {
      next(error);
    }
  };
  editMaterial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const materialId = req.params.id;
      const body = req.body as EditMaterialDTO;
      const result = await this.productService.editMaterial(
        authUserId,
        materialId,
        body,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };

  deleteMaterial = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = Number(res.locals.user.id);
      const materialId = req.params.id;
      const result = await this.productService.deleteMaterial(
        authUserId,
        materialId,
      );
      res.status(200).send(result);
    } catch (error) {
      next(error);
    }
  };
}
