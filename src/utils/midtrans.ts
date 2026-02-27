import crypto from "node:crypto";
import midtransClient from "midtrans-client";
import { PaymentStatus } from "../../generated/prisma/client.js";
import {
  MIDTRANS_CLIENT_KEY,
  MIDTRANS_IS_PRODUCTION,
  MIDTRANS_SERVER_KEY,
} from "../config/env.js";

type CreateSnapTransactionParams = {
  items?: Array<{
    id: string;
    price: number;
    quantity: number;
    name: string;
  }>;
  orderId: string;
  grossAmount: number;
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
  expiryHours?: number;
};

class MidtransService {
  private snap: midtransClient.Snap;

  constructor() {
    this.snap = new midtransClient.Snap({
      isProduction: MIDTRANS_IS_PRODUCTION,
      serverKey: MIDTRANS_SERVER_KEY,
      clientKey: MIDTRANS_CLIENT_KEY,
    });
  }

  createTransaction = async (params: CreateSnapTransactionParams) => {
    const expiryHours = params.expiryHours ?? 24;
    const payload: any = {
      transaction_details: {
        order_id: params.orderId,
        gross_amount: params.grossAmount,
      },
      expiry: {
        unit: "hour",
        duration: expiryHours,
      },
      customer_details: {
        first_name: params.customer.firstName,
        last_name: params.customer.lastName,
        email: params.customer.email,
        phone: params.customer.phone ?? "",
      },
      item_details: params.items,
    };

    return this.snap.createTransaction(payload);
  };

  getSignature = (orderId: string, statusCode: string, grossAmount: string) => {
    return crypto
      .createHash("sha512")
      .update(`${orderId}${statusCode}${grossAmount}${MIDTRANS_SERVER_KEY}`)
      .digest("hex");
  };

  isValidSignature = (
    orderId: string,
    statusCode: string,
    grossAmount: string,
    signatureKey: string,
  ) => {
    return this.getSignature(orderId, statusCode, grossAmount) === signatureKey;
  };

  mapTransactionStatus = (
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
}

const midtransService = new MidtransService();

export default midtransService;
