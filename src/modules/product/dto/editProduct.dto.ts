import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";
import {
  ComponentCategory,
  MaterialCategory,
} from "../../../../generated/prisma/client.js";

export class EditProductDTO {
  @IsString()
  @IsOptional()
  productName?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  productUrl?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  basePrice?: number;

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
  @IsOptional()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  images?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsBoolean()
  @IsOptional()
  isCustomizable?: boolean;
}

export class EditComponentDTO {
  @IsString()
  @IsOptional()
  componentName?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  componentUrl?: string;

  @IsString()
  @IsOptional()
  componentDesc?: string;

  @IsEnum(ComponentCategory)
  @IsOptional()
  componentCategory?: ComponentCategory;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  componentImageUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class EditMaterialDTO {
  @IsString()
  @IsOptional()
  materialName?: string;

  @IsString()
  @IsOptional()
  @IsUrl()
  materialUrl?: string;

  @IsString()
  @IsOptional()
  materialDesc?: string;

  @IsEnum(MaterialCategory)
  @IsOptional()
  materialCategory?: MaterialCategory;

  @IsNumber()
  @IsOptional()
  price?: number;

  @IsArray()
  @IsOptional()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  materialImageUrls?: string[];

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
