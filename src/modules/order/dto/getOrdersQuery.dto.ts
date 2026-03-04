import { IsEnum, IsOptional } from "class-validator";
import { OrderStatus } from "../../../../generated/prisma/client.js";

export class GetOrdersQueryDTO {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;
}
