import { IsNotEmpty, IsObject, IsString } from "class-validator";

export class createSharableDesignDTO {
  @IsString()
  @IsNotEmpty()
  designCode!: string;

  @IsObject()
  configuration!: Record<string, any>;
}
