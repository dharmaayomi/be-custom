import { IsJSON, IsNotEmpty, IsString } from "class-validator";

export class SharableDesignDTO {
  @IsString()
  @IsNotEmpty()
  designCode!: string;

  @IsString()
  @IsNotEmpty()
  configHash!: string;

  @IsJSON()
  @IsNotEmpty()
  configuration!: string;
}
