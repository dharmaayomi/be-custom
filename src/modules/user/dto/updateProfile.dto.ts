import { IsOptional, IsString } from "class-validator";

export class UpdateProfileDTO {
  @IsString()
  @IsOptional()
  userName?: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  avatar?: string;
}
