import { IsNotEmpty, IsString } from "class-validator";

export class ChangePasswordDTO {
  @IsNotEmpty()
  @IsString()
  readonly currentPassword!: string;

  @IsNotEmpty()
  @IsString()
  readonly newPassword!: string;
}
