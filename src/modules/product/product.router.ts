import { Router } from "express";
import { ProductController } from "./product.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { RoleMiddleware } from "../../middlewares/role.middleware.js";
import { CreateProductDTO } from "./dto/createProduct.dto.js";
import { GetProductsQueryDTO } from "./dto/getProductsQuery.dto.js";
import { EditProductDTO } from "./dto/editProduct.dto.js";

export class ProductRouter {
  private router = Router();

  constructor(
    private productController: ProductController,
    private validationMiddleware: ValidationMiddleware,
    private jwtMiddleware: JwtMiddleware,
    private roleMiddleware: RoleMiddleware,
  ) {
    this.initializedRoutes();
  }

  private initializedRoutes = () => {
    this.router.get(
      "/",
      this.validationMiddleware.validateQuery(GetProductsQueryDTO),
      this.productController.getProducts,
    );
    this.router.get("/:id", this.productController.getProductById);
    this.router.patch(
      "/:id",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.validationMiddleware.validateBody(EditProductDTO),
      this.productController.editProduct,
    );
    this.router.post(
      "/upload-signature/image",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.productController.getImageUploadSignature,
    );
    this.router.post(
      "/upload-signature/glb",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.productController.getGlbUploadSignature,
    );
    this.router.post(
      "/",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.validationMiddleware.validateBody(CreateProductDTO),
      this.productController.createProduct,
    );
    this.router.delete(
      "/:id",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.productController.deleteProduct,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
