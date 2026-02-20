import {
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
} from "class-validator";

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
  @IsUrl()
  @IsOptional()
  fileFinalUrl?: string;

  @IsString()
  @IsUrl()
  @IsOptional()
  previewUrl?: string;
}
