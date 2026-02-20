import { Transform } from "class-transformer";
import { IsBoolean, IsEnum, IsOptional, IsString } from "class-validator";
import { ComponentCategory } from "../../../../generated/prisma/client.js";
import { PaginationQueryParams } from "../../pagination/dto/pagination.dto.js";

const parseBooleanQuery = ({ value }: { value: unknown }) => {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return value;
};

export class GetComponentsQueryDTO extends PaginationQueryParams {
  @IsOptional()
  @IsString()
  readonly sortBy: string = "id";

  @IsOptional()
  @Transform(parseBooleanQuery)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsEnum(ComponentCategory)
  componentCategory?: ComponentCategory;

  @IsOptional()
  @IsEnum(ComponentCategory)
  category?: ComponentCategory;

  @IsOptional()
  @IsString()
  name?: string;
}
