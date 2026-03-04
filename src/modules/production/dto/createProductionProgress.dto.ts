import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
} from "class-validator";

export class CreateProductionProgressDTO {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsInt()
  @Min(0)
  @Max(100)
  percentage!: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsUrl({}, { each: true })
  photoUrls!: string[];

  @IsOptional()
  @IsString()
  description?: string;
}
