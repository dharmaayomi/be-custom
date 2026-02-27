import {
  OrderStatus,
  PaymentPhase,
  PaymentStatus,
  PrismaClient,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import midtransService from "../../utils/midtrans.js";

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
  private static readonly SNAP_EXPIRY_HOURS = 1;

  constructor(private prisma: PrismaClient) {}

  private buildMidtransItemDetails = (params: {
    grossAmount: number;
    order: {
      id: string;
      deliveryFee: number | null;
      items: Array<{
        id: string;
        lockedBasePrice: number;
        lockedMaterialPrice: number;
        productBase: { productName: string; sku: string };
        material: { materialName: string; materialSku: string | null } | null;
        components: Array<{
          id: string;
          quantity: number;
          lockedPricePerUnit: number;
          productComponent: {
            componentName: string;
            componentSku: string | null;
          } | null;
        }>;
      }>;
    };
  }) => {
    const items: Array<{
      id: string;
      price: number;
      quantity: number;
      name: string;
    }> = [];
    let runningTotal = 0;

    for (const item of params.order.items) {
      const basePrice = Math.max(0, Math.floor(item.lockedBasePrice));
      if (basePrice > 0) {
        items.push({
          id: item.productBase.sku,
          name: item.productBase.productName,
          price: basePrice,
          quantity: 1,
        });
        runningTotal += basePrice;
      }

      const materialPrice = Math.max(0, Math.floor(item.lockedMaterialPrice));
      if (item.material && materialPrice > 0) {
        items.push({
          id: item.material.materialSku ?? `MAT-${item.id}`,
          name: item.material.materialName,
          price: materialPrice,
          quantity: 1,
        });
        runningTotal += materialPrice;
      }

      for (const component of item.components) {
        const componentPrice = Math.max(
          0,
          Math.floor(component.lockedPricePerUnit),
        );
        if (!component.productComponent || componentPrice <= 0) {
          continue;
        }

        const quantity = Math.max(1, component.quantity);
        items.push({
          id: component.productComponent.componentSku ?? `CMP-${component.id}`,
          name: component.productComponent.componentName,
          price: componentPrice,
          quantity,
        });
        runningTotal += componentPrice * quantity;
      }
    }

    const deliveryFee = Math.max(0, Math.floor(params.order.deliveryFee ?? 0));
    if (deliveryFee > 0) {
      items.push({
        id: "DELIVERY_FEE",
        name: "Delivery Fee",
        price: deliveryFee,
        quantity: 1,
      });
      runningTotal += deliveryFee;
    }

    const adjustment = params.grossAmount - runningTotal;
    if (adjustment > 0) {
      items.push({
        id: `ADJ-${params.order.id}`,
        name: "Payment Adjustment",
        price: adjustment,
        quantity: 1,
      });
    } else if (adjustment < 0 && items.length > 0) {
      let remaining = Math.abs(adjustment);
      for (let i = items.length - 1; i >= 0 && remaining > 0; i -= 1) {
        const lineTotal = items[i].price * items[i].quantity;
        const reducible = Math.min(lineTotal - 1, remaining);
        if (reducible <= 0) {
          continue;
        }
        const perUnitReduction = Math.floor(reducible / items[i].quantity);
        if (perUnitReduction > 0) {
          items[i].price -= perUnitReduction;
          const reduced = perUnitReduction * items[i].quantity;
          remaining -= reduced;
        }
      }

      if (remaining > 0) {
        return [
          {
            id: `ORD-${params.order.id}`,
            name: `Order ${params.order.id}`,
            price: params.grossAmount,
            quantity: 1,
          },
        ];
      }
    }

    return items;
  };

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
        items: {
          where: { deletedAt: null },
          include: {
            productBase: { select: { productName: true, sku: true } },
            material: { select: { materialName: true, materialSku: true } },
            components: {
              where: { deletedAt: null },
              include: {
                productComponent: {
                  select: { componentName: true, componentSku: true },
                },
              },
            },
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
    const itemDetails = this.buildMidtransItemDetails({ order, grossAmount });

    try {
      const midtransResponse = await midtransService.createTransaction({
        orderId: payment.id,
        grossAmount,
        items: itemDetails,
        expiryHours: PaymentService.SNAP_EXPIRY_HOURS,
        customer: {
          firstName: order.user.firstName,
          lastName: order.user.lastName,
          email: order.user.email,
          phone: order.user.phoneNumber ?? "",
        },
      });

      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: payment.id,
          paymentUrl: midtransResponse.redirect_url,
          paymentType: "MIDTRANS_SNAP",
          expiresAt: new Date(
            Date.now() + PaymentService.SNAP_EXPIRY_HOURS * 60 * 60 * 1000,
          ),
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

    if (
      !midtransService.isValidSignature(
        orderId,
        statusCode,
        grossAmount,
        signatureKey,
      )
    ) {
      throw new ApiError("Invalid Midtrans signature", 401);
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { id: orderId },
        include: { order: true },
      });

      if (!payment) {
        return { received: true, ignored: true };
      }

      const grossAmountNumber = Number(grossAmount);
      const expectedGrossAmount = Math.ceil(payment.amount);
      if (
        !Number.isFinite(grossAmountNumber) ||
        grossAmountNumber !== expectedGrossAmount
      ) {
        throw new ApiError("Invalid Midtrans gross amount", 400);
      }

      const nextPaymentStatus = midtransService.mapTransactionStatus(
        transactionStatus,
        fraudStatus,
      );

      // Keep paid payment immutable against duplicate/out-of-order webhook retries.
      if (payment.status === PaymentStatus.PAID) {
        return {
          received: true,
          ignored: true,
          paymentId: payment.id,
          paymentStatus: payment.status,
          orderId: payment.orderId,
          orderStatus: payment.order.status,
        };
      }

      const updatePaymentResult = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { not: PaymentStatus.PAID },
        },
        data: {
          status: nextPaymentStatus,
          paymentType: payload.payment_type ?? payment.paymentType,
          paidAt:
            nextPaymentStatus === PaymentStatus.PAID
              ? (payment.paidAt ?? new Date())
              : payment.paidAt,
        },
      });

      if (updatePaymentResult.count === 0) {
        return {
          received: true,
          ignored: true,
          paymentId: payment.id,
          paymentStatus: payment.status,
          orderId: payment.orderId,
          orderStatus: payment.order.status,
        };
      }

      let nextOrderStatus: OrderStatus | null = null;
      switch (nextPaymentStatus) {
        case PaymentStatus.PAID:
          nextOrderStatus = OrderStatus.PAID;
          break;
        case PaymentStatus.CANCELLED:
        case PaymentStatus.DENIED:
        case PaymentStatus.FAILED:
          nextOrderStatus = OrderStatus.CANCELLED;
          break;
        case PaymentStatus.EXPIRED:
        case PaymentStatus.WAITING_FOR_PAYMENT:
        case PaymentStatus.CHALLENGE:
          nextOrderStatus = OrderStatus.PENDING_PAYMENT;
          break;
      }

      if (nextOrderStatus) {
        await tx.customOrder.updateMany({
          where: {
            id: payment.orderId,
            status: { not: OrderStatus.PAID },
          },
          data: { status: nextOrderStatus },
        });
      }

      return {
        received: true,
        paymentId: payment.id,
        paymentStatus: nextPaymentStatus,
        orderId: payment.orderId,
        orderStatus:
          payment.order.status === OrderStatus.PAID
            ? OrderStatus.PAID
            : (nextOrderStatus ?? payment.order.status),
      };
    });
  };
}
