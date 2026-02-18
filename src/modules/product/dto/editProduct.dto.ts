import {
  ArrayMinSize,
  IsArray,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";

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
}
