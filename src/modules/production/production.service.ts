import {
  OrderStatus,
  PaymentPhase,
  PaymentStatus,
  PrismaClient,
  Role,
} from "../../../generated/prisma/client.js";
import { ApiError } from "../../utils/api-error.js";
import { getDpAmount } from "../../utils/billing.config.js";
import {
  formatIDRCurrency,
  humanizeEnumLabel,
} from "../../utils/formatters.js";
import { NotificationService } from "../notifications/notification.service.js";
import { CreateProductionProgressDTO } from "./dto/createProductionProgress.dto.js";

export class ProductionService {
  constructor(
    private prisma: PrismaClient,
    private notificationService: NotificationService,
  ) {}

  private getLatestPaidPhase = (
    paidPhases: PaymentPhase[],
  ): PaymentPhase | null => {
    const paidSet = new Set(paidPhases);
    if (paidSet.has(PaymentPhase.FINAL)) return PaymentPhase.FINAL;
    if (paidSet.has(PaymentPhase.PROGRESS_2)) return PaymentPhase.PROGRESS_2;
    if (paidSet.has(PaymentPhase.PROGRESS_1)) return PaymentPhase.PROGRESS_1;
    if (paidSet.has(PaymentPhase.DP)) return PaymentPhase.DP;
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

  private roundMoney = (value: number): number => {
    return Math.round((value + Number.EPSILON) * 100) / 100;
  };

  createProductionProgress = async (
    authUserId: number,
    body: CreateProductionProgressDTO,
  ) => {
    const orderId = body.orderId.trim();
    if (!orderId) {
      throw new ApiError("orderId is required", 400);
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const order = await tx.customOrder.findFirst({
        where: { id: orderId, deletedAt: null },
        select: {
          id: true,
          orderNumber: true,
          userId: true,
          status: true,
          grandTotalPrice: true,
          currentPaymentPhase: true,
        },
      });

      if (!order) {
        throw new ApiError("Order not found", 404);
      }

      if (
        order.status === OrderStatus.CANCELLED ||
        order.status === OrderStatus.COMPLETED
      ) {
        throw new ApiError("Cannot add progress for this order status", 400);
      }

      if (body.percentage > 100) {
        throw new ApiError("Total progress cannot exceed 100%", 400);
      }

      const latestProgress = await tx.productionProgress.findFirst({
        where: { orderId },
        orderBy: { percentage: "desc" },
        select: { percentage: true },
      });

      if (latestProgress && body.percentage <= latestProgress.percentage) {
        throw new ApiError(
          `Progress must be greater than previous progress (${latestProgress.percentage}%)`,
          400,
        );
      }

      const normalizedPhotoUrls = body.photoUrls
        .map((url) => url.trim())
        .filter((url) => url.length > 0);
      if (normalizedPhotoUrls.length === 0) {
        throw new ApiError("At least one photo URL is required", 400);
      }

      const createdProgress = await tx.productionProgress.create({
        data: {
          orderId,
          percentage: body.percentage,
          photoUrls: normalizedPhotoUrls,
          description: body.description?.trim() || null,
        } as any,
      });

      if (order.status === OrderStatus.AWAITING_PRODUCTION) {
        await tx.customOrder.update({
          where: { id: orderId },
          data: { status: OrderStatus.IN_PRODUCTION },
        });
      }

      const paidSummary = await tx.payment.aggregate({
        where: {
          orderId,
          status: PaymentStatus.PAID,
        },
        _sum: {
          amount: true,
        },
      });

      const totalPaid = this.roundMoney(paidSummary._sum.amount ?? 0);
      const dpAmount = getDpAmount(order.grandTotalPrice);

      if (totalPaid < dpAmount) {
        return {
          progress: createdProgress,
          paymentCreated: null,
          billing: {
            dpAmount,
            targetCumulative: this.roundMoney(
              (body.percentage / 100) * order.grandTotalPrice,
            ),
            totalPaid,
            remainingToBill: 0,
          },
        };
      }

      const targetCumulative = this.roundMoney(
        (body.percentage / 100) * order.grandTotalPrice,
      );
      const remainingToBill = this.roundMoney(targetCumulative - totalPaid);

      if (remainingToBill <= 0) {
        return {
          progress: createdProgress,
          paymentCreated: null,
          billing: {
            dpAmount,
            targetCumulative,
            totalPaid,
            remainingToBill,
          },
        };
      }

      const existingWaiting = await tx.payment.findFirst({
        where: {
          orderId,
          status: PaymentStatus.WAITING_FOR_PAYMENT,
        },
        select: { id: true },
      });

      if (existingWaiting) {
        return {
          progress: createdProgress,
          paymentCreated: null,
          billing: {
            dpAmount,
            targetCumulative,
            totalPaid,
            remainingToBill,
          },
        };
      }

      const paidPayments = await tx.payment.findMany({
        where: {
          orderId,
          status: PaymentStatus.PAID,
        },
        select: { phase: true },
      });
      const latestPaidPhase = this.getLatestPaidPhase(
        paidPayments.map((item) => item.phase),
      );

      if (latestPaidPhase !== order.currentPaymentPhase) {
        await tx.customOrder.update({
          where: { id: orderId },
          data: { currentPaymentPhase: latestPaidPhase },
        });
      }

      const nextPhase = this.getNextPhase(latestPaidPhase);
      if (!nextPhase) {
        return {
          progress: createdProgress,
          paymentCreated: null,
          billing: {
            dpAmount,
            targetCumulative,
            totalPaid,
            remainingToBill,
          },
        };
      }

      let paymentCreated = null as {
        id: string;
        phase: PaymentPhase;
        progressPercentageSnapshot: number | null;
        amount: number;
        status: PaymentStatus;
      } | null;

      const existingPhasePayment = await tx.payment.findUnique({
        where: {
          orderId_phase: {
            orderId,
            phase: nextPhase,
          },
        },
        select: {
          id: true,
          phase: true,
          progressPercentageSnapshot: true,
          amount: true,
          status: true,
        },
      });

      if (!existingPhasePayment) {
        paymentCreated = await tx.payment.create({
          data: {
            orderId,
            phase: nextPhase,
            progressPercentageSnapshot: body.percentage,
            amount: remainingToBill,
            status: PaymentStatus.WAITING_FOR_PAYMENT,
          },
          select: {
            id: true,
            phase: true,
            progressPercentageSnapshot: true,
            amount: true,
            status: true,
          },
        });
      } else if (existingPhasePayment.status !== PaymentStatus.PAID) {
        paymentCreated = await tx.payment.update({
          where: { id: existingPhasePayment.id },
          data: {
            progressPercentageSnapshot: body.percentage,
            amount: remainingToBill,
            status: PaymentStatus.WAITING_FOR_PAYMENT,
            paidAt: null,
          },
          select: {
            id: true,
            phase: true,
            progressPercentageSnapshot: true,
            amount: true,
            status: true,
          },
        });
      }

      if (paymentCreated) {
        await tx.customOrder.update({
          where: { id: orderId },
          data: { currentPaymentPhase: nextPhase },
        });
      }

      return {
        progress: createdProgress,
        paymentCreated,
        billing: {
          dpAmount,
          targetCumulative,
          totalPaid,
          remainingToBill,
        },
      };
    });

    const order = await this.prisma.customOrder.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        grandTotalPrice: true,
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
    const orderRef = order?.orderNumber ?? orderId;
    const paymentCreated = result.paymentCreated;

    if (order) {
      const paymentPhaseLabel = paymentCreated
        ? humanizeEnumLabel(paymentCreated.phase)
        : null;
      const paymentAmountLabel = paymentCreated
        ? formatIDRCurrency(paymentCreated.amount)
        : null;
      const userMessage = paymentCreated
        ? `Progress order ${orderRef} diperbarui ke ${body.percentage}%. Foto progress terbaru sudah bisa dilihat. Tagihan ${paymentPhaseLabel} sebesar ${paymentAmountLabel} telah dibuat.`
        : `Progress order ${orderRef} diperbarui ke ${body.percentage}%. Foto progress terbaru sudah bisa dilihat.`;

      const notificationTasks = [
        this.notificationService.createNotification({
          role: Role.USER,
          targetUserId: order.userId,
          title: "Update progress produksi",
          message: userMessage,
        }),
      ];

      if (paymentCreated) {
        notificationTasks.push(
          this.notificationService.createNotification({
            role: Role.ADMIN,
            targetUserId: null,
            title: "Tagihan progress dibuat",
            message: `Order ${orderRef} progress ${body.percentage}% menghasilkan tagihan ${paymentPhaseLabel} sebesar ${paymentAmountLabel}.`,
          }),
        );
      }

      await Promise.allSettled(notificationTasks);
    }

    return {
      ...result,
      paymentCreated,
    };
  };

  getProductionProgress = async (authUserId: number, orderId: string) => {
    void authUserId;

    return this.prisma.productionProgress.findMany({
      where: {
        orderId,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        orderId: true,
        percentage: true,
        photoUrls: true,
        description: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  };
  getAllProductionProgressess = async (authUserId: number) => {};
}
