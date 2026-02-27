import {
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";
import { DeliveryType } from "../../../../generated/prisma/client.js";

export class CreateOrderDTO {
  @IsOptional()
  @IsString()
  designCode?: string;

  @IsNotEmpty()
  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;

  @IsNotEmpty({ message: "Shipping address is required" })
  @IsNumber()
  addressId!: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  configuration?: Record<string, unknown>;
}
