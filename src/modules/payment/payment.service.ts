import {
  OrderStatus,
  PaymentPhase,
  PaymentStatus,
  PrismaClient,
} from "../../../generated/prisma/client.js";
import crypto from "node:crypto";
import midtransClient from "midtrans-client";
import {
  MIDTRANS_CLIENT_KEY,
  MIDTRANS_IS_PRODUCTION,
  MIDTRANS_SERVER_KEY,
} from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";

type CreateSnapTransactionInput = {
  authUserId: number;
  orderId: string;
  phase?: PaymentPhase;
};

type MidtransWebhookInput = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
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
    const phase = body.phase ?? PaymentPhase.DP;

    if (!orderId) {
      throw new ApiError("orderId is required", 400);
    }

    const order = await this.prisma.customOrder.findFirst({
      where: {
        id: orderId,
        userId: body.authUserId,
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
    });

    if (!order) {
      throw new ApiError("Order not found", 404);
    }

    let payment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        phase,
      },
      orderBy: { createdAt: "desc" },
    });

    if (
      !payment ||
      ["EXPIRED", "CANCELLED", "FAILED", "DENIED"].includes(payment.status)
    ) {
      payment = await this.prisma.payment.create({
        data: {
          orderId,
          phase,
          amount: order.grandTotalPrice,
          status: "WAITING_FOR_PAYMENT",
        },
      });
    }

    if (payment.status === "PAID") {
      throw new ApiError("Payment already paid", 400);
    }

    const grossAmount = Math.ceil(payment.amount);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      throw new ApiError("Payment amount is invalid", 400);
    }

    try {
      const transactionPayload: any = {
        transaction_details: {
          order_id: payment.id,
          gross_amount: grossAmount,
        },
        customer_details: {
          first_name: order.user.firstName,
          last_name: order.user.lastName,
          email: order.user.email,
          phone: order.user.phoneNumber ?? "",
        },
      };

      const midtransResponse =
        await this.snap.createTransaction(transactionPayload);

      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: payment.id,
          paymentUrl: midtransResponse.redirect_url,
          paymentType: "MIDTRANS_SNAP",
        },
      });

      return {
        orderId: order.id,
        paymentId: updatedPayment.id,
        phase: updatedPayment.phase,
        amount: updatedPayment.amount,
        paymentUrl: midtransResponse.redirect_url,
        token: midtransResponse.token,
      };
    } catch (error: any) {
      const message =
        typeof error?.message === "string"
          ? error.message
          : "Failed to create Midtrans transaction";

      throw new ApiError(message, 502);
    }
  };

  private getMidtransSignature = (
    orderId: string,
    statusCode: string,
    grossAmount: string,
  ) => {
    return crypto
      .createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${MIDTRANS_SERVER_KEY}`)
      .digest("hex");
  };

  private mapMidtransToPaymentStatus = (
    transactionStatus: string,
    fraudStatus?: string,
  ): PaymentStatus => {
    switch (transactionStatus) {
      case "capture":
        return fraudStatus === "challenge"
          ? PaymentStatus.CHALLENGE
          : PaymentStatus.PAID;
      case "settlement":
        return PaymentStatus.PAID;
      case "pending":
        return PaymentStatus.WAITING_FOR_PAYMENT;
      case "deny":
        return PaymentStatus.DENIED;
      case "expire":
        return PaymentStatus.EXPIRED;
      case "cancel":
        return PaymentStatus.CANCELLED;
      case "failure":
      case "refund":
      case "partial_refund":
      case "chargeback":
      case "partial_chargeback":
        return PaymentStatus.FAILED;
      default:
        return PaymentStatus.WAITING_FOR_PAYMENT;
    }
  };

  handleMidtransWebhook = async (payload: MidtransWebhookInput) => {
    const orderId = payload.order_id?.trim();
    const statusCode = payload.status_code?.trim();
    const grossAmount = payload.gross_amount?.trim();
    const signatureKey = payload.signature_key?.trim();
    const transactionStatus = payload.transaction_status?.trim();
    const fraudStatus = payload.fraud_status?.trim();

    if (
      !orderId ||
      !statusCode ||
      !grossAmount ||
      !signatureKey ||
      !transactionStatus
    ) {
      throw new ApiError("Invalid Midtrans webhook payload", 400);
    }

    const expectedSignature = this.getMidtransSignature(
      orderId,
      statusCode,
      grossAmount,
    );

    if (signatureKey !== expectedSignature) {
      throw new ApiError("Invalid Midtrans signature", 401);
    }

    const payment = await this.prisma.payment.findUnique({
      where: { id: orderId },
      include: { order: true },
    });

    if (!payment) {
      return { received: true, ignored: true };
    }

    const nextPaymentStatus = this.mapMidtransToPaymentStatus(
      transactionStatus,
      fraudStatus,
    );

    const updatedPayment = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: nextPaymentStatus,
        paymentType: payload.payment_type ?? payment.paymentType,
        paidAt:
          nextPaymentStatus === PaymentStatus.PAID
            ? (payment.paidAt ?? new Date())
            : payment.paidAt,
      },
    });

    let nextOrderStatus: OrderStatus | null = null;
    switch (nextPaymentStatus) {
      case PaymentStatus.PAID:
        nextOrderStatus = OrderStatus.PAID;
        break;
      case PaymentStatus.CANCELLED:
      case PaymentStatus.DENIED:
      case PaymentStatus.EXPIRED:
      case PaymentStatus.FAILED:
        nextOrderStatus = OrderStatus.CANCELLED;
        break;
      case PaymentStatus.WAITING_FOR_PAYMENT:
      case PaymentStatus.CHALLENGE:
        nextOrderStatus = OrderStatus.PENDING_PAYMENT;
        break;
    }

    if (nextOrderStatus && payment.order.status !== OrderStatus.PAID) {
      await this.prisma.customOrder.update({
        where: { id: payment.orderId },
        data: { status: nextOrderStatus },
      });
    }

    return {
      received: true,
      paymentId: updatedPayment.id,
      paymentStatus: updatedPayment.status,
      orderId: payment.orderId,
      orderStatus: nextOrderStatus ?? payment.order.status,
    };
  };
}
