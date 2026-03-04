import {
  OrderStatus,
  PaymentPhase,
  PaymentStatus,
  Prisma,
  PrismaClient,
  Role,
} from "../../../generated/prisma/client.js";
import { BASE_URL_FE } from "../../config/env.js";
import { ApiError } from "../../utils/api-error.js";
import midtransService from "../../utils/midtrans.js";
import { NotificationService } from "../notifications/notification.service.js";
import { PaginationService } from "../pagination/pagination.service.js";
import { GetPaymentsQueryDTO } from "./dto/getPaymentsQuery.dto.js";

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
  private static readonly PHASE_SEQUENCE: PaymentPhase[] = [
    PaymentPhase.DP,
    PaymentPhase.PROGRESS_1,
    PaymentPhase.PROGRESS_2,
    PaymentPhase.FINAL,
  ];
  private paginationService = new PaginationService();

  constructor(
    private prisma: PrismaClient,
    private notificationService: NotificationService,
  ) {}

  private createNotificationIfNotExists = async (params: {
    role: Role;
    title: string;
    message: string;
    targetUserId?: number | null;
  }) => {
    const existing = await this.prisma.notification.findFirst({
      where: {
        role: params.role,
        title: params.title,
        message: params.message,
        targetUserId: params.targetUserId ?? null,
      },
      select: { id: true },
    });

    if (existing) {
      return existing;
    }

    return this.notificationService.createNotification({
      role: params.role,
      title: params.title,
      message: params.message,
      targetUserId: params.targetUserId ?? null,
    });
  };

  private getNextUnpaidPhase = (
    paidPhases: PaymentPhase[],
  ): PaymentPhase | null => {
    const paidSet = new Set(paidPhases);
    for (const phase of PaymentService.PHASE_SEQUENCE) {
      if (!paidSet.has(phase)) {
        return phase;
      }
    }
    return null;
  };

  private getPhaseAmount = (
    grandTotalPrice: number,
    phase: PaymentPhase,
  ): number => {
    const normalizedTotal = Math.max(0, Math.ceil(grandTotalPrice));
    const quarter = Math.floor(normalizedTotal / 4);
    const finalPortion = normalizedTotal - quarter * 3;

    switch (phase) {
      case PaymentPhase.DP:
      case PaymentPhase.PROGRESS_1:
      case PaymentPhase.PROGRESS_2:
        return quarter;
      case PaymentPhase.FINAL:
        return finalPortion;
      default:
        return normalizedTotal;
    }
  };

  private getMinimumProgressForPhase = (phase: PaymentPhase): number => {
    switch (phase) {
      case PaymentPhase.PROGRESS_1:
        return 50;
      case PaymentPhase.PROGRESS_2:
        return 75;
      case PaymentPhase.FINAL:
        return 100;
      default:
        return 0;
    }
  };

  private notifyPhaseAvailable = async (params: {
    orderId: string;
    orderNumber: string | null;
    phase: PaymentPhase;
    progressPercentage: number;
    targetUserId: number;
  }) => {
    const progressLabel = `${params.progressPercentage}%`;
    const phaseLabel = params.phase;
    const orderRef = params.orderNumber ?? params.orderId;

    const userTitle = "Tahap pembayaran tersedia";
    const userMessage = [
      `Progress produksi order ${orderRef} telah mencapai ${progressLabel}.`,
      `Silakan lakukan pembayaran ${phaseLabel} untuk melanjutkan proses.`,
    ].join(" ");

    const adminTitle = "Progress milestone tercapai";
    const adminMessage = [
      `Order ${orderRef} mencapai progress ${progressLabel}.`,
      `Tahap pembayaran ${phaseLabel} sudah dapat ditagihkan ke customer.`,
    ].join(" ");

    const notificationResults = await Promise.allSettled([
      this.createNotificationIfNotExists({
        role: Role.USER,
        title: userTitle,
        message: userMessage,
        targetUserId: params.targetUserId,
      }),
      this.createNotificationIfNotExists({
        role: Role.ADMIN,
        title: adminTitle,
        message: adminMessage,
        targetUserId: null,
      }),
    ]);

    notificationResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const target = index === 0 ? "USER" : "ADMIN";
        console.error(
          `[Order ${params.orderId}] Failed to create ${target} phase-available notification:`,
          result.reason,
        );
      }
    });
  };

  private notifyDpPaidAwaitingProduction = async (params: {
    orderId: string;
    orderNumber: string | null;
    targetUserId: number;
  }) => {
    const orderRef = params.orderNumber ?? params.orderId;
    const userTitle = "Pembayaran DP diterima";
    const userMessage = [
      `Pembayaran DP untuk order ${orderRef} telah diterima.`,
      "Status order berubah menjadi AWAITING_PRODUCTION dan menunggu produksi dimulai.",
    ].join(" ");

    const adminTitle = "Order menunggu produksi";
    const adminMessage = [
      `DP order ${orderRef} telah dibayar.`,
      "Status order kini AWAITING_PRODUCTION dan siap dijadwalkan ke produksi.",
    ].join(" ");

    const notificationResults = await Promise.allSettled([
      this.createNotificationIfNotExists({
        role: Role.USER,
        title: userTitle,
        message: userMessage,
        targetUserId: params.targetUserId,
      }),
      this.createNotificationIfNotExists({
        role: Role.ADMIN,
        title: adminTitle,
        message: adminMessage,
        targetUserId: null,
      }),
    ]);

    notificationResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const target = index === 0 ? "USER" : "ADMIN";
        console.error(
          `[Order ${params.orderId}] Failed to create ${target} DP-paid notification:`,
          result.reason,
        );
      }
    });
  };

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

    if (
      order.status === OrderStatus.CANCELLED ||
      order.status === OrderStatus.COMPLETED
    ) {
      throw new ApiError("This order can no longer receive payment", 400);
    }

    const paidPayments = await this.prisma.payment.findMany({
      where: {
        orderId,
        status: PaymentStatus.PAID,
      },
      select: { phase: true },
      orderBy: { createdAt: "asc" },
    });
    const paidPhases = paidPayments.map((item) => item.phase);
    const expectedPhase = this.getNextUnpaidPhase(paidPhases);
    if (!expectedPhase) {
      throw new ApiError("All payment phases are already paid", 400);
    }
    const phase = body.phase ?? expectedPhase;

    if (phase !== expectedPhase) {
      throw new ApiError(
        `Invalid payment phase. Expected ${expectedPhase}, received ${phase}`,
        400,
      );
    }

    const latestProgress = await this.prisma.productionProgress.findFirst({
      where: { orderId },
      orderBy: { createdAt: "desc" },
      select: { percentage: true },
    });
    const latestProgressPercentage = latestProgress?.percentage ?? 0;

    if (phase === PaymentPhase.PROGRESS_1 && latestProgressPercentage < 50) {
      throw new ApiError(
        "PROGRESS_1 payment is available when production reaches at least 50%",
        400,
      );
    }
    if (phase === PaymentPhase.PROGRESS_2 && latestProgressPercentage < 75) {
      throw new ApiError(
        "PROGRESS_2 payment is available when production reaches at least 75%",
        400,
      );
    }
    if (phase === PaymentPhase.FINAL && latestProgressPercentage < 100) {
      throw new ApiError(
        "FINAL payment is available when production reaches 100%",
        400,
      );
    }

    if (
      phase === PaymentPhase.PROGRESS_1 ||
      phase === PaymentPhase.PROGRESS_2 ||
      phase === PaymentPhase.FINAL
    ) {
      const minimumProgress = this.getMinimumProgressForPhase(phase);
      if (latestProgressPercentage >= minimumProgress) {
        await this.notifyPhaseAvailable({
          orderId: order.id,
          orderNumber: order.orderNumber ?? null,
          phase,
          progressPercentage: latestProgressPercentage,
          targetUserId: order.userId,
        });
      }
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
      const phaseAmount = this.getPhaseAmount(order.grandTotalPrice, phase);
      if (phaseAmount <= 0) {
        throw new ApiError("Calculated payment amount is invalid", 400);
      }
      payment = await this.prisma.payment.create({
        data: {
          orderId,
          phase,
          amount: phaseAmount,
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
        callbacks: BASE_URL_FE
          ? {
              finish: `${BASE_URL_FE}/dashboard/billing?orderId=${order.id}`,
              unfinish: `${BASE_URL_FE}/checkout?orderId=${order.id}`,
              error: `${BASE_URL_FE}/checkout?orderId=${order.id}`,
            }
          : undefined,
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

    const transactionResult = await this.prisma.$transaction(async (tx) => {
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

      let resolvedOrderStatus = payment.order.status;

      if (nextPaymentStatus === PaymentStatus.PAID) {
        const paidPayments = await tx.payment.findMany({
          where: {
            orderId: payment.orderId,
            status: PaymentStatus.PAID,
          },
          select: {
            phase: true,
            amount: true,
          },
        });

        const paidPhaseSet = new Set(paidPayments.map((item) => item.phase));
        const totalAmountPaid = paidPayments.reduce(
          (sum, item) => sum + item.amount,
          0,
        );
        const remainingAmount = Math.max(
          0,
          payment.order.grandTotalPrice - totalAmountPaid,
        );

        let currentPaymentPhase: PaymentPhase = PaymentPhase.DP;
        if (paidPhaseSet.has(PaymentPhase.FINAL)) {
          currentPaymentPhase = PaymentPhase.FINAL;
        } else if (paidPhaseSet.has(PaymentPhase.PROGRESS_2)) {
          currentPaymentPhase = PaymentPhase.FINAL;
        } else if (paidPhaseSet.has(PaymentPhase.PROGRESS_1)) {
          currentPaymentPhase = PaymentPhase.PROGRESS_2;
        } else if (paidPhaseSet.has(PaymentPhase.DP)) {
          currentPaymentPhase = PaymentPhase.PROGRESS_1;
        }

        if (
          paidPhaseSet.has(PaymentPhase.FINAL) &&
          payment.order.status !== OrderStatus.SHIPPED &&
          payment.order.status !== OrderStatus.COMPLETED &&
          payment.order.status !== OrderStatus.CANCELLED
        ) {
          resolvedOrderStatus = OrderStatus.READY_TO_SHIP;
        } else if (
          paidPhaseSet.has(PaymentPhase.DP) &&
          payment.order.status === OrderStatus.PENDING_PAYMENT
        ) {
          resolvedOrderStatus = OrderStatus.AWAITING_PRODUCTION;
        }

        await tx.customOrder.update({
          where: { id: payment.orderId },
          data: {
            status: resolvedOrderStatus,
            currentPaymentPhase,
            totalAmountPaid,
            remainingAmount,
          },
        });
      } else if (payment.phase === PaymentPhase.DP) {
        if (
          nextPaymentStatus === PaymentStatus.CANCELLED ||
          nextPaymentStatus === PaymentStatus.DENIED ||
          nextPaymentStatus === PaymentStatus.FAILED
        ) {
          resolvedOrderStatus = OrderStatus.CANCELLED;
        } else if (
          nextPaymentStatus === PaymentStatus.EXPIRED ||
          nextPaymentStatus === PaymentStatus.WAITING_FOR_PAYMENT ||
          nextPaymentStatus === PaymentStatus.CHALLENGE
        ) {
          resolvedOrderStatus = OrderStatus.PENDING_PAYMENT;
        }

        if (resolvedOrderStatus !== payment.order.status) {
          await tx.customOrder.update({
            where: { id: payment.orderId },
            data: { status: resolvedOrderStatus },
          });
        }
      }

      return {
        received: true,
        paymentId: payment.id,
        paymentStatus: nextPaymentStatus,
        orderId: payment.orderId,
        orderStatus: resolvedOrderStatus,
        paymentPhase: payment.phase,
        orderNumber: payment.order.orderNumber,
        orderUserId: payment.order.userId,
      };
    });

    if (
      !("ignored" in transactionResult) &&
      transactionResult.paymentStatus === PaymentStatus.PAID &&
      transactionResult.paymentPhase === PaymentPhase.DP &&
      transactionResult.orderStatus === OrderStatus.AWAITING_PRODUCTION
    ) {
      await this.notifyDpPaidAwaitingProduction({
        orderId: transactionResult.orderId,
        orderNumber: transactionResult.orderNumber ?? null,
        targetUserId: transactionResult.orderUserId,
      });
    }

    return transactionResult;
  };

  getPayment = async (authUserId: number, paymentId: string) => {
    const normalizedPaymentId = paymentId.trim();
    if (!normalizedPaymentId) {
      throw new ApiError("paymentId is required", 400);
    }

    const payment = await this.prisma.payment.findFirst({
      where: {
        id: normalizedPaymentId,
        order: {
          userId: authUserId,
          deletedAt: null,
        },
      },
      include: {
        order: true,
      },
    });

    if (!payment) {
      throw new ApiError("Payment not found", 404);
    }

    return payment;
  };

  getPayments = async (authUserId: number, query: GetPaymentsQueryDTO) => {
    const { page, perPage, sortBy, orderBy, dateFrom, dateTo } = query;

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      throw new ApiError("dateFrom cannot be greater than dateTo", 400);
    }

    const skip = (page - 1) * perPage;
    const allowedSortBy = new Set([
      "id",
      "phase",
      "status",
      "amount",
      "paidAt",
      "expiresAt",
      "createdAt",
      "updatedAt",
    ]);

    if (!allowedSortBy.has(sortBy)) {
      throw new ApiError("sortBy is not valid for payments", 400);
    }

    const where: Prisma.PaymentWhereInput = {
      order: {
        userId: authUserId,
        deletedAt: null,
      },
      ...(dateFrom || dateTo
        ? {
            createdAt: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [count, data] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          [sortBy]: orderBy,
        } as Prisma.PaymentOrderByWithRelationInput,
        include: {
          order: true,
        },
      }),
    ]);

    const meta = this.paginationService.generateMeta({
      page,
      perPage,
      count,
    });

    return { data, meta };
  };
}
