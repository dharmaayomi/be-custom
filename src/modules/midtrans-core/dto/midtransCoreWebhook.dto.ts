import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class MidtransCoreWebhookDTO {
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @IsString()
  @IsNotEmpty()
  status_code!: string;

  @IsString()
  @IsNotEmpty()
  gross_amount!: string;

  @IsString()
  @IsNotEmpty()
  signature_key!: string;

  @IsString()
  @IsNotEmpty()
  transaction_status!: string;

  @IsOptional()
  @IsString()
  fraud_status?: string;

  @IsOptional()
  @IsString()
  payment_type?: string;
}
