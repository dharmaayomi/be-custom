import { Router } from "express";
import { ProductController } from "./product.controller.js";
import { ValidationMiddleware } from "../../middlewares/validation.middleware.js";
import { JwtMiddleware } from "../../middlewares/jwt.middleware.js";
import { RoleMiddleware } from "../../middlewares/role.middleware.js";
import {
  CreateComponentDTO,
  CreateMaterialDTO,
  CreateProductDTO,
} from "./dto/createProduct.dto.js";
import { GetProductsQueryDTO } from "./dto/getProductsQuery.dto.js";
import {
  EditComponentDTO,
  EditMaterialDTO,
  EditProductDTO,
} from "./dto/editProduct.dto.js";

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
    this.router.post(
      "/component",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.validationMiddleware.validateBody(CreateComponentDTO),
      this.productController.createComponent,
    );
    this.router.post(
      "/material",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.validationMiddleware.validateBody(CreateMaterialDTO),
      this.productController.createMaterial,
    );
    this.router.patch(
      "/component/:id/edit",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.validationMiddleware.validateBody(EditComponentDTO),
      this.productController.editComponent,
    );
    this.router.delete(
      "/component/:id",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.productController.deleteComponent,
    );
    this.router.patch(
      "/material/:id/edit",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.validationMiddleware.validateBody(EditMaterialDTO),
      this.productController.editMaterial,
    );
    this.router.delete(
      "/material/:id",
      this.jwtMiddleware.verifyToken(),
      this.roleMiddleware.verifyRole(["ADMIN"]),
      this.productController.deleteMaterial,
    );
  };

  getRouter = () => {
    return this.router;
  };
}
