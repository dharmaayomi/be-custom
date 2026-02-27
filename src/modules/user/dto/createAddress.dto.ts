import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from "class-validator";

export class CreateAddressDTO {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsString()
  @IsNotEmpty()
  recipientName!: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber!: string;

  @IsString()
  @IsNotEmpty()
  line1!: string;

  @IsString()
  @IsOptional()
  line2?: string;

  @IsString()
  @IsNotEmpty()
  city!: string;

  @IsString()
  @IsNotEmpty()
  district!: string;

  @IsString()
  @IsNotEmpty()
  subdistrict!: string;

  @IsString()
  @IsNotEmpty()
  province!: string;

  @IsString()
  @IsNotEmpty()
  provinceCode!: string;

  @IsString()
  @IsNotEmpty()
  cityCode!: string;

  @IsString()
  @IsNotEmpty()
  districtCode!: string;

  @IsString()
  @IsNotEmpty()
  subdistrictCode!: string;

  @IsString()
  @IsNotEmpty()
  country!: string;

  @IsNotEmpty()
  @IsBoolean()
  isDefault!: boolean;

  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: "Latitude must be a valid number" })
  readonly latitude!: number;

  @IsNotEmpty()
  @Transform(({ value }) => parseFloat(value))
  @IsNumber({}, { message: "Longitude must be a valid number" })
  readonly longitude!: number;

  @IsString()
  @IsNotEmpty()
  postalCode!: string;
}
