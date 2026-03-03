import { IsDateString, IsOptional } from "class-validator";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto.js";

export class GetPaymentsQueryDTO extends PaginationQueryParams {
  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;
}
