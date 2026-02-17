import { Type } from "class-transformer";
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { SortOrder } from "../types.js";

export class PaginationQueryParams {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  readonly perPage: number = 6;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  readonly page: number = 1;

  @IsOptional()
  @IsString()
  readonly sortBy: string = "createdAt";

  @IsOptional()
  @IsEnum(SortOrder)
  readonly orderBy: SortOrder = SortOrder.DESC;

  @IsOptional()
  @IsString()
  readonly search?: string;
}
