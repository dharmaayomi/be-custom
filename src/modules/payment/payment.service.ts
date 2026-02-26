import {
  PaymentPhase,
  PrismaClient,
} from "../../../generated/prisma/client.js";
import midtransClient from "midtrans-client";
import {
  MIDTRANS_CLIENT_KEY,
  MIDTRANS_IS_PRODUCTION,
  MIDTRANS_SERVER_KEY,
} from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

type CreateSnapTransactionInput = {
  orderId: string;
  phase: PaymentPhase;
};

export class PaymentService {
  private readonly snap: midtransClient.Snap;

  constructor(private prisma: PrismaClient) {
    this.snap = new midtransClient.Snap({
      isProduction: MIDTRANS_IS_PRODUCTION,
      serverKey: MIDTRANS_SERVER_KEY,
      clientKey: MIDTRANS_CLIENT_KEY,
    });
  }

  createSnapTransaction = async (body: CreateSnapTransactionInput) => {
    const orderId = body.orderId.trim();

    if (!orderId) {
      throw new ApiError("orderId is required", 400);
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        phase: body.phase,
      },
      select: {
        id: true,
        amount: true,
        status: true,
      },
    });

    if (!payment) {
      throw new ApiError("Payment not found", 404);
    }

    if (payment.status === "PAID") {
      throw new ApiError("Payment already paid", 400);
    }

    const grossAmount = Math.ceil(payment.amount);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      throw new ApiError("Payment amount is invalid", 400);
    }

    try {
      const midtransResponse = await this.snap.createTransaction({
        transaction_details: {
          order_id: payment.id,
          gross_amount: grossAmount,
        },
      });

      await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: payment.id,
          paymentUrl: midtransResponse.redirect_url,
        },
      });

      return midtransResponse;
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message
          : "Failed to create Midtrans transaction";

      throw new ApiError(message, 502);
    }
  };
}
