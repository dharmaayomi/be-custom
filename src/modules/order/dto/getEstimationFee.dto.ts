import { Type } from "class-transformer";
import { IsNotEmpty, IsNumber, IsObject } from "class-validator";

export class GetEstimationFeeDto {
  @Type(() => Number)
  @IsNumber()
  addressId!: number;

  @IsNotEmpty()
  @IsObject()
  configuration!: Record<string, unknown>;
}
