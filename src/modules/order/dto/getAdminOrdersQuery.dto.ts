import { IsDateString, IsEnum, IsOptional } from "class-validator";
import { OrderStatus } from "../../../../generated/prisma/client.js";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto.js";

export class GetAdminOrdersQueryDTO extends PaginationQueryParams {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
