import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";
import { DeliveryType } from "../../../../generated/prisma/client.js";

export class CreateOrderDTO {
  @IsOptional()
  @IsString()
  userDesign?: string;

  @IsNotEmpty()
  @IsEnum(DeliveryType)
  deliveryType!: DeliveryType;
}
