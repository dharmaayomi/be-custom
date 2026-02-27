import { PaymentPhase } from "../../../../generated/prisma/client.js";
import { IsEnum, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateSnapPaymentDTO {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  @IsEnum(PaymentPhase)
  phase?: PaymentPhase;
}
