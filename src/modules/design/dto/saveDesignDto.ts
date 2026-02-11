import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class SaveDesignDTO {
  @IsString()
  @IsOptional()
  designCode?: string;

  @IsString()
  @IsNotEmpty()
  designName!: string;

  @IsObject()
  configuration!: Record<string, any>;

  @IsString()
  @IsOptional()
  fileFinalUrl?: string;
}
