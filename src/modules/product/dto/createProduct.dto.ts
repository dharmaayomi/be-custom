import {
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsUrl,
} from "class-validator";

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

  @IsString()
  @IsNotEmpty()
  basePrice!: string;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  images!: string[];
}
