import {
  IsJSON,
  IsNotEmpty,
  isNotEmpty,
  IsString,
  isString,
} from "class-validator";

export class SaveUserDesignDTO {
  @IsString()
  @IsNotEmpty()
  designCode!: string;

  @IsString()
  @IsNotEmpty()
  designName!: string;

  @IsJSON()
  @IsNotEmpty()
  configuration!: string;

  @IsString()
  @IsNotEmpty()
  fileFinalURL!: string;
}
