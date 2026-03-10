import { ApiError } from "../../utils/api-error.js";
import midtransService from "../../utils/midtrans.js";
import { ChargeCoreApiDTO } from "./dto/chargeCoreApi.dto.js";
import { MidtransCoreWebhookDTO } from "./dto/midtransCoreWebhook.dto.js";

type MidtransSdkError = {
  message?: string;
  httpStatusCode?: number;
};

export class MidtransCoreService {
  charge = async (payload: ChargeCoreApiDTO) => {
    try {
      return await midtransService.chargeTransaction(payload);
    } catch (error) {
      const typedError = error as MidtransSdkError;
      throw new ApiError(
        typedError.message ?? "Failed to charge Midtrans Core API",
        typedError.httpStatusCode ?? 502,
      );
    }
  };

  getStatus = async (orderId: string) => {
    const normalizedOrderId = orderId.trim();
    if (!normalizedOrderId) {
      throw new ApiError("orderId is required", 400);
    }

    try {
      return await midtransService.checkStatus(normalizedOrderId);
    } catch (error) {
      const typedError = error as MidtransSdkError;
      throw new ApiError(
        typedError.message ?? "Failed to get Midtrans transaction status",
        typedError.httpStatusCode ?? 502,
      );
    }
  };

  handleWebhook = async (payload: MidtransCoreWebhookDTO) => {
    const isValid = midtransService.isValidSignature(
      payload.order_id,
      payload.status_code,
      payload.gross_amount,
      payload.signature_key,
    );

    if (!isValid) {
      throw new ApiError("Invalid Midtrans signature", 401);
    }

    const currentStatus = await this.getStatus(payload.order_id);

    return {
      received: true,
      orderId: payload.order_id,
      notificationStatus: payload.transaction_status,
      verifiedStatus: currentStatus.transaction_status,
      fraudStatus: currentStatus.fraud_status ?? null,
      paymentType: currentStatus.payment_type ?? payload.payment_type ?? null,
      raw: currentStatus,
    };
  };
}
