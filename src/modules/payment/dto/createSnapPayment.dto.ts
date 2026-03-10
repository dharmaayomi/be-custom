import { PaymentPhase } from "../../../../generated/prisma/client.js";
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
} from "class-validator";

export const PAYMENT_CHANNELS = ["CORE"] as const;
export type PaymentChannel = (typeof PAYMENT_CHANNELS)[number];

export class CreateSnapPaymentDTO {
  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsOptional()
  @IsEnum(PaymentPhase)
  phase?: PaymentPhase;

  @IsOptional()
  @IsIn(PAYMENT_CHANNELS)
  channel?: PaymentChannel;

  @IsOptional()
  @IsObject()
  corePayload?: Record<string, unknown>;
}
