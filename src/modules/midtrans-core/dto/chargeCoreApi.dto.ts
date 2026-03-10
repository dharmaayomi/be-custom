import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNotEmptyObject,
  IsNumber,
  IsObject,
  IsString,
  ValidateNested,
} from "class-validator";

class TransactionDetailsDTO {
  @IsString()
  @IsNotEmpty()
  order_id!: string;

  @Type(() => Number)
  @IsNumber()
  gross_amount!: number;
}

export class ChargeCoreApiDTO {
  @IsString()
  @IsNotEmpty()
  payment_type!: string;

  @IsObject()
  @IsNotEmptyObject()
  @ValidateNested()
  @Type(() => TransactionDetailsDTO)
  transaction_details!: TransactionDetailsDTO;
}
