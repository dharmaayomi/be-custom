import { Router } from "express";
import { ProductController } from "./product.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { CreateProductDTO } from "./dto/createProduct.dto.js";
import { GetProductsQueryDTO } from "./dto/getProductsQuery.dto.js";

export class ProductRouter {
  private router = Router();

  constructor(
    private productController: ProductController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
  ) {
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get(
      "/",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateQuery(GetProductsQueryDTO),
      this.productController.getProducts,
    );
    this.router.post(
      "/upload-signature/image",
      this.jwtMiddleware.verifyToken(),
      this.productController.getImageUploadSignature,
    );
    this.router.post(
      "/upload-signature/glb",
      this.jwtMiddleware.verifyToken(),
      this.productController.getGlbUploadSignature,
    );
    this.router.post(
      "/",
      this.jwtMiddleware.verifyToken(),
      this.validationMiddleware.validateBody(CreateProductDTO),
      this.productController.createProduct,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
