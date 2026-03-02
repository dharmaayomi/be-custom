import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  ValidateIf,
} from "class-validator";
import { Type } from "class-transformer";
import { DeliveryType } from "../../../../generated/prisma/client.js";

export class CreateOrderDTO {
  @IsOptional()
  @IsString()
  designCode?: string;

  @IsNotEmpty()
  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;

  @ValidateIf(
    (obj: CreateOrderDTO) => obj.deliveryType === DeliveryType.DELIVERY,
  )
  @IsNotEmpty({ message: "Shipping address is required" })
  @Type(() => Number)
  @IsNumber()
  addressId?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  @IsUrl()
  previewUrl?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
