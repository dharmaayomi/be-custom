import { IsEmail, IsNotEmpty, IsString } from "class-validator";

export class RequestDeleteAccountDTO {
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}

export class ConfirmDeletionAccountDTO {
  @IsNotEmpty()
  @IsString()
  password!: string;
}
