import { randomUUID } from "node:crypto";
import {
  OrderStatus,
  PaymentPhase,
  PaymentStatus,
  Prisma,
  PrismaClient,
  Role,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { humanizeEnumLabel } from "../../utils/formatters.js";
import midtransService from "../../utils/midtrans.js";
import { NotificationService } from "../notifications/notification.service.js";
import { PaginationService } from "../pagination/pagination.service.js";
import { PaymentChannel } from "./dto/createSnapPayment.dto.js";
import { GetPaymentsQueryDTO } from "./dto/getPaymentsQuery.dto.js";

type CreateSnapTransactionInput = {
  authUserId: number;
  orderId: string;
  phase?: PaymentPhase;
  channel?: PaymentChannel;
  corePayload?: Record<string, unknown>;
};

type MidtransWebhookInput = {
  order_id?: string;
  status_code?: string;
  gross_amount?: string;
  signature_key?: string;
  transaction_status?: string;
  fraud_status?: string;
  payment_type?: string;
  va_numbers?: Array<{ bank?: string; va_number?: string }>;
  permata_va_number?: string;
  bill_key?: string;
  biller_code?: string;
  qr_string?: string;
  payment_code?: string;
  acquirer?: string;
};

type PaymentAttemptMethodFields = {
  midtransPaymentType?: string;
  midtransBank?: string;
  midtransReference?: string;
};

export class PaymentService {
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

  private getLatestPaidPhase = (
    paidPhases: PaymentPhase[],
  ): PaymentPhase | null => {
    const paidSet = new Set(paidPhases);
    if (paidSet.has(PaymentPhase.FINAL)) {
      return PaymentPhase.FINAL;
    }
    if (paidSet.has(PaymentPhase.PROGRESS_2)) {
      return PaymentPhase.PROGRESS_2;
    }
    if (paidSet.has(PaymentPhase.PROGRESS_1)) {
      return PaymentPhase.PROGRESS_1;
    }
    if (paidSet.has(PaymentPhase.DP)) {
      return PaymentPhase.DP;
    }
    return null;
  };

  private getNextPhase = (
    currentPhase: PaymentPhase | null,
  ): PaymentPhase | null => {
    switch (currentPhase) {
      case null:
        return PaymentPhase.DP;
      case PaymentPhase.DP:
        return PaymentPhase.PROGRESS_1;
      case PaymentPhase.PROGRESS_1:
        return PaymentPhase.PROGRESS_2;
      case PaymentPhase.PROGRESS_2:
        return PaymentPhase.FINAL;
      case PaymentPhase.FINAL:
      default:
        return null;
    }
  };

  private getDpAmount = (grandTotalPrice: number): number => {
    return Math.ceil(grandTotalPrice * 0.25);
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

  private getPhasePercentage = (
    phaseAmount: number,
    grandTotalPrice: number,
  ): number => {
    if (grandTotalPrice <= 0) {
      return 0;
    }
    return Number(((phaseAmount / grandTotalPrice) * 100).toFixed(2));
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
    const phaseLabel = humanizeEnumLabel(params.phase);
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
    const awaitingProductionLabel = humanizeEnumLabel(
      OrderStatus.AWAITING_PRODUCTION,
    );
    const orderRef = params.orderNumber ?? params.orderId;
    const userTitle = "Pembayaran DP diterima";
    const userMessage = [
      `Pembayaran DP untuk order ${orderRef} telah diterima.`,
      `Status order berubah menjadi ${awaitingProductionLabel} dan menunggu produksi dimulai.`,
    ].join(" ");

    const adminTitle = "Order menunggu produksi";
    const adminMessage = [
      `DP order ${orderRef} telah dibayar.`,
      `Status order kini ${awaitingProductionLabel} dan siap dijadwalkan ke produksi.`,
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

  private toMidtransPaymentType = (paymentType: string) => {
    return `MIDTRANS_${paymentType.toUpperCase()}`;
  };

  private buildCoreChargePayload = (params: {
    paymentId: string;
    grossAmount: number;
    fallbackItems: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
    customer: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
    };
    corePayload?: Record<string, unknown>;
  }) => {
    const sourcePayload = params.corePayload;
    if (
      !sourcePayload ||
      typeof sourcePayload !== "object" ||
      Array.isArray(sourcePayload)
    ) {
      throw new ApiError("corePayload is required when channel is CORE", 400);
    }

    const paymentType = sourcePayload.payment_type;
    if (typeof paymentType !== "string" || paymentType.trim().length === 0) {
      throw new ApiError("corePayload.payment_type is required", 400);
    }

    const payload: Record<string, unknown> = {
      ...sourcePayload,
      transaction_details: {
        ...(typeof sourcePayload.transaction_details === "object" &&
        sourcePayload.transaction_details &&
        !Array.isArray(sourcePayload.transaction_details)
          ? (sourcePayload.transaction_details as Record<string, unknown>)
          : {}),
        order_id: params.paymentId,
        gross_amount: params.grossAmount,
      },
    };

    if (!payload.customer_details) {
      payload.customer_details = {
        first_name: params.customer.firstName,
        last_name: params.customer.lastName,
        email: params.customer.email,
        phone: params.customer.phone ?? "",
      };
    }

    if (!payload.item_details) {
      payload.item_details = params.fallbackItems;
    }

    return payload;
  };

  private normalizeCoreChargeResponse = (response: any) => {
    const actions = Array.isArray(response?.actions)
      ? response.actions.filter(
          (action: any) =>
            action &&
            typeof action === "object" &&
            typeof action.url === "string",
        )
      : [];

    const primaryActionUrl =
      actions.find((action: any) => action.name === "deeplink-redirect")?.url ??
      actions[0]?.url ??
      null;

    const paymentUrl =
      (typeof response?.redirect_url === "string" && response.redirect_url) ||
      primaryActionUrl;

    return {
      paymentUrl,
      vaNumbers: Array.isArray(response?.va_numbers) ? response.va_numbers : [],
      permataVaNumber:
        typeof response?.permata_va_number === "string"
          ? response.permata_va_number
          : null,
      billKey:
        typeof response?.bill_key === "string" ? response.bill_key : null,
      billerCode:
        typeof response?.biller_code === "string" ? response.biller_code : null,
      qrString:
        typeof response?.qr_string === "string" ? response.qr_string : null,
      actions,
      raw: response,
    };
  };

  private deriveMidtransMethodFields = (payload: any) => {
    const midtransPaymentType =
      typeof payload?.payment_type === "string"
        ? payload.payment_type
        : undefined;

    const vaNumbers = Array.isArray(payload?.va_numbers)
      ? payload.va_numbers
      : undefined;
    const vaBank =
      vaNumbers &&
      vaNumbers.length > 0 &&
      typeof vaNumbers[0]?.bank === "string"
        ? vaNumbers[0].bank
        : undefined;
    const permataBank =
      typeof payload?.permata_va_number === "string" ? "permata" : undefined;
    const mandiriBank =
      midtransPaymentType === "echannel" ||
      (typeof payload?.bill_key === "string" &&
        typeof payload?.biller_code === "string")
        ? "mandiri"
        : undefined;
    const midtransBank = vaBank ?? permataBank ?? mandiriBank;

    const referencePayload: Record<string, unknown> = {};
    if (vaNumbers) referencePayload.va_numbers = vaNumbers;
    if (typeof payload?.permata_va_number === "string") {
      referencePayload.permata_va_number = payload.permata_va_number;
    }
    if (typeof payload?.bill_key === "string") {
      referencePayload.bill_key = payload.bill_key;
    }
    if (typeof payload?.biller_code === "string") {
      referencePayload.biller_code = payload.biller_code;
    }
    if (typeof payload?.qr_string === "string") {
      referencePayload.qr_string = payload.qr_string;
    }
    if (typeof payload?.payment_code === "string") {
      referencePayload.payment_code = payload.payment_code;
    }
    if (typeof payload?.acquirer === "string") {
      referencePayload.acquirer = payload.acquirer;
    }
    if (Array.isArray(payload?.actions)) {
      referencePayload.actions = payload.actions;
    }

    const midtransReference =
      Object.keys(referencePayload).length > 0
        ? JSON.stringify(referencePayload)
        : undefined;

    return {
      midtransPaymentType,
      midtransBank,
      midtransReference,
    } satisfies PaymentAttemptMethodFields;
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
    const latestPaidPhase = this.getLatestPaidPhase(paidPhases);

    if (order.currentPaymentPhase !== latestPaidPhase) {
      await this.prisma.customOrder.update({
        where: { id: orderId },
        data: { currentPaymentPhase: latestPaidPhase },
      });
    }

    const existingWaitingPayment = await this.prisma.payment.findFirst({
      where: {
        orderId,
        status: PaymentStatus.WAITING_FOR_PAYMENT,
      },
      orderBy: { createdAt: "desc" },
    });

    let payment = existingWaitingPayment;
    let expectedPhase = payment?.phase ?? this.getNextPhase(latestPaidPhase);

    if (!expectedPhase) {
      throw new ApiError("All payment phases are already paid", 400);
    }

    const phase = body.phase ?? expectedPhase;
    if (phase !== expectedPhase) {
      throw new ApiError(
        `Invalid payment phase. Expected ${expectedPhase}, received ${phase}. Retry without phase to use the next valid phase automatically.`,
        400,
        "PAYMENT_PHASE_MISMATCH",
      );
    }

    if (!payment) {
      const existingPhasePayment = await this.prisma.payment.findUnique({
        where: {
          orderId_phase: { orderId, phase },
        },
      });

      if (existingPhasePayment) {
        if (existingPhasePayment.status === PaymentStatus.PAID) {
          throw new ApiError("Payment already paid", 400);
        }

        payment =
          existingPhasePayment.status === PaymentStatus.WAITING_FOR_PAYMENT
            ? existingPhasePayment
            : await this.prisma.payment.update({
                where: { id: existingPhasePayment.id },
                data: {
                  status: PaymentStatus.WAITING_FOR_PAYMENT,
                  paidAt: null,
                },
              });
      } else {
        if (phase !== PaymentPhase.DP) {
          throw new ApiError(
            "No invoice available for this phase yet. Wait for production progress update.",
            400,
          );
        }

        const phaseAmount = this.getDpAmount(order.grandTotalPrice);
        if (phaseAmount <= 0) {
          throw new ApiError("Calculated payment amount is invalid", 400);
        }
        payment = await this.prisma.payment.create({
          data: {
            orderId,
            phase,
            progressPercentageSnapshot: null,
            amount: phaseAmount,
            status: PaymentStatus.WAITING_FOR_PAYMENT,
          },
        });

        if (phase === PaymentPhase.DP && order.currentPaymentPhase === null) {
          await this.prisma.customOrder.update({
            where: { id: orderId },
            data: { currentPaymentPhase: PaymentPhase.DP },
          });
        }
      }
    }

    if (!payment) {
      throw new ApiError("Payment could not be initialized", 500);
    }

    if (payment.status === PaymentStatus.PAID) {
      throw new ApiError("Payment already paid", 400);
    }

    const grossAmount = Math.ceil(payment.amount);
    if (!Number.isFinite(grossAmount) || grossAmount <= 0) {
      throw new ApiError("Payment amount is invalid", 400);
    }
    const phasePercentage = this.getPhasePercentage(
      grossAmount,
      order.grandTotalPrice,
    );
    const itemDetails = [
      {
        id: `PHASE-${payment.phase}`,
        name: `${payment.phase} (${phasePercentage}%)`,
        price: grossAmount,
        quantity: 1,
      },
    ];

    try {
      const channel = body.channel ?? "CORE";
      if (channel !== "CORE") {
        throw new ApiError("SNAP payment is disabled. Use CORE channel.", 400);
      }

      const midtransOrderId = `mta-${randomUUID().replace(/-/g, "")}`;
      const paymentAttempt = await this.prisma.paymentAttempt.create({
        data: {
          paymentId: payment.id,
          midtransOrderId,
          progressPercentageSnapshot: payment.progressPercentageSnapshot,
          status: PaymentStatus.WAITING_FOR_PAYMENT,
        },
      });

      const corePayload = this.buildCoreChargePayload({
        paymentId: paymentAttempt.midtransOrderId,
        grossAmount,
        fallbackItems: itemDetails,
        customer: {
          firstName: order.user.firstName,
          lastName: order.user.lastName,
          email: order.user.email,
          phone: order.user.phoneNumber ?? "",
        },
        corePayload: body.corePayload,
      });

      const coreResponse = await midtransService.chargeTransaction(corePayload);
      const normalized = this.normalizeCoreChargeResponse(coreResponse);
      const methodFields = this.deriveMidtransMethodFields(coreResponse);
      const paymentType =
        typeof coreResponse?.payment_type === "string"
          ? coreResponse.payment_type
          : "core_api";
      const expiryTime =
        typeof coreResponse?.expiry_time === "string"
          ? new Date(coreResponse.expiry_time)
          : null;

      const updatedPayment = await this.prisma.payment.update({
        where: { id: payment.id },
        data: {
          externalId: payment.id,
          paymentUrl: normalized.paymentUrl,
          paymentType: this.toMidtransPaymentType(paymentType),
          midtransPaymentType: methodFields.midtransPaymentType,
          midtransBank: methodFields.midtransBank,
          midtransReference: methodFields.midtransReference,
          expiresAt:
            expiryTime && !Number.isNaN(expiryTime.getTime())
              ? expiryTime
              : null,
        },
      });

      await this.prisma.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: PaymentStatus.WAITING_FOR_PAYMENT,
          paymentUrl: normalized.paymentUrl,
          paymentType: this.toMidtransPaymentType(paymentType),
          midtransPaymentType: methodFields.midtransPaymentType,
          midtransBank: methodFields.midtransBank,
          midtransReference: methodFields.midtransReference,
          expiresAt:
            expiryTime && !Number.isNaN(expiryTime.getTime())
              ? expiryTime
              : null,
          rawResponse: coreResponse,
        },
      });

      return {
        orderId: order.id,
        paymentId: updatedPayment.id,
        paymentAttemptId: paymentAttempt.id,
        midtransOrderId: paymentAttempt.midtransOrderId,
        phase: updatedPayment.phase,
        phasePercentage,
        grandTotalPrice: order.grandTotalPrice,
        amount: updatedPayment.amount,
        channel: "CORE",
        paymentType,
        paymentUrl: normalized.paymentUrl,
        vaNumbers: normalized.vaNumbers,
        permataVaNumber: normalized.permataVaNumber,
        billKey: normalized.billKey,
        billerCode: normalized.billerCode,
        qrString: normalized.qrString,
        actions: normalized.actions,
        raw: normalized.raw,
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
      const paymentAttempt = await tx.paymentAttempt.findUnique({
        where: { midtransOrderId: orderId },
        include: {
          payment: {
            include: { order: true },
          },
        },
      });

      if (!paymentAttempt) {
        return { received: true, ignored: true };
      }
      const payment = paymentAttempt.payment;

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
      const methodFields = this.deriveMidtransMethodFields(payload);

      if (paymentAttempt.status === PaymentStatus.PAID) {
        return {
          received: true,
          ignored: true,
          paymentId: paymentAttempt.paymentId,
          paymentAttemptId: paymentAttempt.id,
          paymentStatus: paymentAttempt.status,
          orderId: payment.orderId,
          orderStatus: payment.order.status,
        };
      }

      const updatedAttempt = await tx.paymentAttempt.update({
        where: { id: paymentAttempt.id },
        data: {
          status: nextPaymentStatus,
          paymentType: payload.payment_type
            ? this.toMidtransPaymentType(payload.payment_type)
            : paymentAttempt.paymentType,
          midtransPaymentType:
            methodFields.midtransPaymentType ??
            paymentAttempt.midtransPaymentType ??
            null,
          midtransBank:
            methodFields.midtransBank ?? paymentAttempt.midtransBank ?? null,
          midtransReference:
            methodFields.midtransReference ??
            paymentAttempt.midtransReference ??
            null,
          paidAt:
            nextPaymentStatus === PaymentStatus.PAID
              ? (paymentAttempt.paidAt ?? new Date())
              : paymentAttempt.paidAt,
        },
      });

      // Keep paid payment immutable against duplicate/out-of-order webhook retries.
      if (payment.status === PaymentStatus.PAID) {
        return {
          received: true,
          ignored: true,
          paymentId: payment.id,
          paymentAttemptId: updatedAttempt.id,
          paymentStatus: payment.status,
          orderId: payment.orderId,
          orderStatus: payment.order.status,
        };
      }

      const updateData: Prisma.PaymentUpdateManyMutationInput = {
        status: nextPaymentStatus,
        paymentType: payload.payment_type
          ? this.toMidtransPaymentType(payload.payment_type)
          : payment.paymentType,
        paidAt:
          nextPaymentStatus === PaymentStatus.PAID
            ? (payment.paidAt ?? new Date())
            : payment.paidAt,
      };

      if (methodFields.midtransPaymentType) {
        updateData.midtransPaymentType = methodFields.midtransPaymentType;
      }
      if (methodFields.midtransBank) {
        updateData.midtransBank = methodFields.midtransBank;
      }
      if (methodFields.midtransReference) {
        updateData.midtransReference = methodFields.midtransReference;
      }
      if (updatedAttempt.expiresAt) {
        updateData.expiresAt = updatedAttempt.expiresAt;
      }

      const updatePaymentResult = await tx.payment.updateMany({
        where: {
          id: payment.id,
          status: { not: PaymentStatus.PAID },
        },
        data: updateData,
      });

      if (updatePaymentResult.count === 0) {
        return {
          received: true,
          ignored: true,
          paymentId: payment.id,
          paymentAttemptId: updatedAttempt.id,
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
          },
        });

        const paidPhaseSet = new Set(paidPayments.map((item) => item.phase));
        const currentPaymentPhase = this.getLatestPaidPhase(
          paidPayments.map((item) => item.phase),
        );

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
        paymentAttemptId: updatedAttempt.id,
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
        attempts: {
          orderBy: { createdAt: "desc" },
        },
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
          attempts: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
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

  getPaymentAttempts = async (authUserId: number, paymentId: string) => {
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
      select: { id: true },
    });

    if (!payment) {
      throw new ApiError("Payment not found", 404);
    }

    return this.prisma.paymentAttempt.findMany({
      where: { paymentId: normalizedPaymentId },
      orderBy: { createdAt: "desc" },
    });
  };

  getPaymentAttempt = async (authUserId: number, attemptId: string) => {
    const normalizedAttemptId = attemptId.trim();
    if (!normalizedAttemptId) {
      throw new ApiError("attemptId is required", 400);
    }

    const attempt = await this.prisma.paymentAttempt.findFirst({
      where: {
        id: normalizedAttemptId,
        payment: {
          order: {
            userId: authUserId,
            deletedAt: null,
          },
        },
      },
    });

    if (!attempt) {
      throw new ApiError("Payment attempt not found", 404);
    }

    return attempt;
  };
}
