import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";
import {
  ComponentCategory,
  MaterialCategory,
} from "../../../../generated/prisma/client.js";

export class CreateProductDTO {
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @IsString()
  @IsNotEmpty()
  sku!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  productUrl!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @IsNotEmpty()
  basePrice!: number;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsNumber()
  @IsOptional()
  height?: number;

  @IsNumber()
  @IsOptional()
  width?: number;

  @IsNumber()
  @IsOptional()
  depth?: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  images!: string[];
}

export class CreateComponentDTO {
  @IsString()
  @IsNotEmpty()
  componentName!: string;

  @IsString()
  @IsNotEmpty()
  componentSku!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  componentUrl!: string;

  @IsString()
  @IsNotEmpty()
  componentDesc!: string;

  @IsEnum(ComponentCategory)
  @IsNotEmpty()
  componentCategory!: ComponentCategory;

  @IsNumber()
  @IsNotEmpty()
  price!: number;

  @IsNumber()
  @IsNotEmpty()
  weight!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  componentImageUrls!: string[];
}

export class CreateMaterialDTO {
  @IsString()
  @IsNotEmpty()
  materialName!: string;

  @IsString()
  @IsNotEmpty()
  materialSku!: string;

  @IsString()
  @IsNotEmpty()
  @IsUrl()
  materialUrl!: string;

  @IsString()
  @IsNotEmpty()
  materialDesc!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(MaterialCategory, { each: true })
  materialCategories!: MaterialCategory[];

  @IsNumber()
  @IsNotEmpty()
  price!: number;
}
