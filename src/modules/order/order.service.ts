import {
  DeliveryType,
  OrderStatus,
  PaymentPhase,
  Prisma,
  PrismaClient,
  Role,
} from "../../../generated/prisma/client.js";
import { CreateOrderDTO } from "./dto/createOrder.dto.js";
import { GetAdminOrdersQueryDTO } from "./dto/getAdminOrdersQuery.dto.js";
import { GetOrdersQueryDTO } from "./dto/getOrdersQuery.dto.js";
import { ApiError } from "../../utils/api-error.js";
import {
  RAJAONGKIR_API_COST_KEY,
  RAJAONGKIR_ORIGIN_SUBDISTRICT_ID,
  STORE_LATITUDE,
  STORE_LONGITUDE,
} from "../../config/env.js";
import { customAlphabet } from "nanoid";
import { MailService } from "../mail/mail.service.js";
import { NotificationService } from "../notifications/notification.service.js";
import { PaginationService } from "../pagination/pagination.service.js";

interface DesignModel {
  id: string;
  texture: string | null;
}

interface DesignConfiguration {
  mainModels: DesignModel[];
  addOnModels: DesignModel[];
}

interface LockedComponent {
  componentId: string;
  quantity: number;
  lockedPricePerUnit: number;
  lockedSubTotal: number;
}

interface LockedItem {
  instanceId: string;
  productBaseId: string;
  materialId: string | null;
  lockedBasePrice: number;
  lockedMaterialPrice: number;
  itemTotalPrice: number;
  itemWeight: number;
  components: LockedComponent[];
}

interface PricingResult {
  lockedItems: LockedItem[];
  subtotalPrice: number;
  totalWeight: number;
}

export class OrderService {
  private readonly DEFAULT_ORIGIN_SUBDISTRICT_ID = "43249";
  private readonly DEFAULT_COURIER = "jne";
  private readonly RAJAONGKIR_DOMESTIC_COST_URL =
    "https://rajaongkir.komerce.id/api/v1/calculate/domestic-cost";
  private paginationService = new PaginationService();

  constructor(
    private prisma: PrismaClient,
    private mailService: MailService,
    private notificationService: NotificationService,
  ) {}

  private formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Math.round(value));
  };

  private formatDateTime = (value: Date): string => {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "Asia/Jakarta",
    }).format(value);
  };

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Strip instance suffix from model id.
   * "cmlsujgx70008fgvtwbc0myzs_1" → "cmlsujgx70008fgvtwbc0myzs"
   */
  private stripInstanceSuffix = (modelId: string): string => {
    return modelId.replace(/_\d+$/, "");
  };

  /**
   * Accept either material id (with optional instance suffix) or direct material URL.
   */
  private normalizeMaterialReference = (
    materialRef: string | null,
  ): { id: string | null; materialUrl: string | null } => {
    if (!materialRef) {
      return { id: null, materialUrl: null };
    }

    const normalizedRef = materialRef.trim();
    if (!normalizedRef) {
      return { id: null, materialUrl: null };
    }

    const isLikelyUrl = /^https?:\/\//i.test(normalizedRef);
    if (isLikelyUrl) {
      return { id: null, materialUrl: normalizedRef };
    }

    return { id: this.stripInstanceSuffix(normalizedRef), materialUrl: null };
  };

  /**
   * Aggregate addOnModels by componentId (count instances = quantity).
   *
   * TODO: addOnModels currently has no parentId (prototype).
   * When frontend adds parentId, update this to group per mainModel instance
   * so components can be attached to the correct CustomOrderItem.
   */
  private aggregateAddons = (
    addOnModels: DesignModel[],
  ): Map<string, number> => {
    const quantities = new Map<string, number>();
    for (const addon of addOnModels) {
      const componentId = this.stripInstanceSuffix(addon.id);
      quantities.set(componentId, (quantities.get(componentId) ?? 0) + 1);
    }
    return quantities;
  };

  // ── Pricing ──────────────────────────────────────────────────────────────────

  private calculatePricingFromDesign = async (
    configuration: unknown,
  ): Promise<PricingResult> => {
    const config = configuration as DesignConfiguration;

    if (!config?.mainModels || config.mainModels.length === 0) {
      throw new ApiError("Design has no products to order", 400);
    }

    // Aggregate all addons globally: componentId → total quantity
    const globalAddons = this.aggregateAddons(config.addOnModels ?? []);

    // Lock each component from DB, accumulate global price & weight
    const lockedGlobalComponents: LockedComponent[] = [];
    let globalComponentTotalPrice = 0;
    let globalComponentTotalWeight = 0;

    for (const [componentId, quantity] of globalAddons) {
      const component = await this.prisma.productComponent.findFirst({
        where: { id: componentId, isActive: true, deletedAt: null },
      });
      if (!component) {
        throw new ApiError(
          `Component not found or inactive: ${componentId}`,
          404,
        );
      }

      const lockedSubTotal = component.price * quantity;
      const componentWeight = component.weight * quantity;

      globalComponentTotalPrice += lockedSubTotal;
      globalComponentTotalWeight += componentWeight;

      lockedGlobalComponents.push({
        componentId,
        quantity,
        lockedPricePerUnit: component.price,
        lockedSubTotal,
      });
    }

    // Lock each mainModel (ProductBase + optional Material)
    const lockedItems: LockedItem[] = [];
    let subtotalPrice = 0;
    let totalWeight = 0;

    for (const model of config.mainModels) {
      const productBaseId = this.stripInstanceSuffix(model.id);
      const { id: materialId, materialUrl } = this.normalizeMaterialReference(
        model.texture,
      );

      const productBase = await this.prisma.productBase.findFirst({
        where: { id: productBaseId, isActive: true, deletedAt: null },
      });
      if (!productBase) {
        throw new ApiError(
          `Product not found or inactive: ${productBaseId}`,
          404,
        );
      }

      let lockedMaterialPrice = 0;
      if (materialId || materialUrl) {
        const material = await this.prisma.productMaterials.findFirst({
          where: {
            isActive: true,
            deletedAt: null,
            OR: [
              ...(materialId ? [{ id: materialId }] : []),
              ...(materialUrl ? [{ materialUrl }] : []),
            ],
          },
        });
        if (!material) {
          throw new ApiError(
            `Material not found or inactive: ${materialId ?? materialUrl}`,
            404,
          );
        }
        lockedMaterialPrice = material.price ?? 0;
      }

      // TODO: Replace with per-item components once parentId exists on addOnModels.
      // For now, all components are attached to the first item only to avoid
      // double-counting price & weight across items.
      const isFirstItem = lockedItems.length === 0;
      const itemComponents = isFirstItem ? lockedGlobalComponents : [];
      const itemComponentPrice = isFirstItem ? globalComponentTotalPrice : 0;
      const itemComponentWeight = isFirstItem ? globalComponentTotalWeight : 0;

      const itemTotalPrice =
        productBase.basePrice + lockedMaterialPrice + itemComponentPrice;
      const itemWeight = productBase.weight + itemComponentWeight;

      subtotalPrice += itemTotalPrice;
      totalWeight += itemWeight;

      lockedItems.push({
        instanceId: model.id,
        productBaseId,
        materialId,
        lockedBasePrice: productBase.basePrice,
        lockedMaterialPrice,
        itemTotalPrice,
        itemWeight,
        components: itemComponents,
      });
    }

    if (totalWeight <= 0) {
      throw new ApiError(
        "Total weight is zero — check product weights in DB.",
        500,
      );
    }

    return { lockedItems, subtotalPrice, totalWeight };
  };

  // ── Existing (unchanged) ─────────────────────────────────────────────────────

  private getRajaOngkirCostValue = (payload: any): number | null => {
    const komerceCost = payload?.data?.[0]?.cost;
    if (typeof komerceCost === "number" && Number.isFinite(komerceCost)) {
      return komerceCost;
    }

    const legacyCost =
      payload?.rajaongkir?.results?.[0]?.costs?.[0]?.cost?.[0]?.value;
    if (typeof legacyCost === "number" && Number.isFinite(legacyCost)) {
      return legacyCost;
    }

    return null;
  };

  private calculateDeliveryFee = async (
    destinationSubdistrictId: string,
    weightKg: number,
  ) => {
    if (!RAJAONGKIR_API_COST_KEY) {
      throw new ApiError("RajaOngkir cost key is not configured", 500);
    }

    const originSubdistrictId =
      RAJAONGKIR_ORIGIN_SUBDISTRICT_ID ?? this.DEFAULT_ORIGIN_SUBDISTRICT_ID;
    const billableWeightGrams = Math.max(1, Math.ceil(weightKg * 1000));

    const response = await fetch(this.RAJAONGKIR_DOMESTIC_COST_URL, {
      method: "POST",
      headers: {
        key: RAJAONGKIR_API_COST_KEY,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        origin: originSubdistrictId,
        destination: destinationSubdistrictId,
        weight: billableWeightGrams.toString(),
        courier: this.DEFAULT_COURIER,
      }),
    });

    const responsePayload = await response.json();

    if (!response.ok) {
      console.error(
        "[RajaOngkir]",
        response.status,
        JSON.stringify(responsePayload),
      );
      throw new ApiError("Failed to fetch delivery fee from RajaOngkir", 502);
    }

    const cost = this.getRajaOngkirCostValue(responsePayload);

    if (cost === null || cost < 0) {
      throw new ApiError("RajaOngkir returned invalid delivery fee", 502);
    }

    return cost;
  };

  private calculateDeliveryDistanceKm = (
    destinationLat?: number | null,
    destinationLng?: number | null,
  ): number | null => {
    if (
      typeof STORE_LATITUDE !== "number" ||
      Number.isNaN(STORE_LATITUDE) ||
      typeof STORE_LONGITUDE !== "number" ||
      Number.isNaN(STORE_LONGITUDE) ||
      typeof destinationLat !== "number" ||
      Number.isNaN(destinationLat) ||
      typeof destinationLng !== "number" ||
      Number.isNaN(destinationLng)
    ) {
      return null;
    }

    const toRadians = (deg: number) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const latDistance = toRadians(destinationLat - STORE_LATITUDE);
    const lngDistance = toRadians(destinationLng - STORE_LONGITUDE);

    const a =
      Math.sin(latDistance / 2) ** 2 +
      Math.cos(toRadians(STORE_LATITUDE)) *
        Math.cos(toRadians(destinationLat)) *
        Math.sin(lngDistance / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return Math.round(earthRadiusKm * c * 100) / 100;
  };

  createCustomOrder = async (authUserId: number, body: CreateOrderDTO) => {
    const { designCode, deliveryType, addressId, notes, configuration } = body;
    const requestedPreviewUrl = body.previewUrl?.trim() || null;

    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: {
        id: true,
        firstName: true,
        email: true,
        accountStatus: true,
        deletedAt: true,
      },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("User account not found or inactive", 404);
    }

    let design = null as Awaited<
      ReturnType<typeof this.prisma.userDesign.findFirst>
    >;
    let resolvedConfiguration: Prisma.InputJsonValue;
    let designSnapshot: Prisma.InputJsonValue;
    let resolvedPreviewUrl: string | null = requestedPreviewUrl;

    if (designCode?.trim()) {
      design = await this.prisma.userDesign.findFirst({
        where: {
          designCode: designCode.trim(),
          userId: authUserId,
          deletedAt: null,
        },
      });

      if (!design) {
        throw new ApiError("Design not found or doesn't belong to you", 404);
      }

      resolvedConfiguration = design.configuration as Prisma.InputJsonValue;
      designSnapshot = design.configuration as Prisma.InputJsonValue;
      resolvedPreviewUrl = design.previewUrl ?? requestedPreviewUrl;
    } else {
      if (!configuration || typeof configuration !== "object") {
        throw new ApiError(
          "configuration is required when designCode is not provided",
          400,
        );
      }

      resolvedConfiguration = configuration as Prisma.InputJsonValue;
      designSnapshot = configuration as Prisma.InputJsonValue;
    }

    const address =
      deliveryType === DeliveryType.DELIVERY
        ? await this.prisma.address.findFirst({
            where: {
              id: addressId,
              userId: authUserId,
            },
          })
        : null;

    if (deliveryType === DeliveryType.DELIVERY && !address) {
      throw new ApiError("Shipping address not found", 404);
    }

    if (
      deliveryType === DeliveryType.DELIVERY &&
      (!address || !address.komerceSubdistrictId)
    ) {
      throw new ApiError(
        "Address komerceSubdistrictId is required for delivery calculation. Please re-save this address.",
        400,
      );
    }

    const snapShotAddress =
      deliveryType === DeliveryType.DELIVERY && address
        ? {
            label: address.label,
            recipientName: address.recipientName,
            phoneNumber: address.phoneNumber,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            district: address.district,
            subdistrict: address.subdistrict,
            province: address.province,
            provinceCode: address.provinceCode,
            cityCode: address.cityCode,
            districtCode: address.districtCode,
            subdistrictCode: address.subdistrictCode,
            komerceSubdistrictId: address.komerceSubdistrictId,
            country: address.country,
            latitude: address.latitude,
            longitude: address.longitude,
            postalCode: address.postalCode,
          }
        : {
            type: "PICKUP",
            note: "Pickup at store",
          };

    const { lockedItems, subtotalPrice, totalWeight } =
      await this.calculatePricingFromDesign(resolvedConfiguration);

    const deliveryFee =
      deliveryType === DeliveryType.PICKUP
        ? 0
        : await this.calculateDeliveryFee(
            address!.komerceSubdistrictId as string,
            totalWeight,
          );
    const deliveryDistance =
      deliveryType === DeliveryType.PICKUP
        ? null
        : this.calculateDeliveryDistanceKm(
            address!.latitude,
            address!.longitude,
          );
    const grandTotalPrice = subtotalPrice + deliveryFee;

    const nanoid = customAlphabet("0123456789", 8);
    const generateOrderCode = () => {
      return `CSTF-${nanoid()}`;
    };
    const maxOrderNumberRetry = 3;
    for (let attempt = 1; attempt <= maxOrderNumberRetry; attempt += 1) {
      try {
        const createdOrder = await this.prisma.customOrder.create({
          data: {
            userId: authUserId,
            userDesignId: design?.id,
            designSnapShot: designSnapshot,
            previewUrl: resolvedPreviewUrl,
            addressId: address?.id,
            snapShotAddress,
            orderNumber: generateOrderCode(),
            deliveryType: deliveryType,
            subtotalPrice,
            totalWeight,
            deliveryDistance,
            deliveryFee,
            status: "PENDING_PAYMENT",
            currentPaymentPhase: PaymentPhase.DP,
            totalAmountPaid: 0,
            remainingAmount: grandTotalPrice,
            notes: notes?.trim(),
            grandTotalPrice,
            items: {
              create: lockedItems.map((item) => ({
                productBaseId: item.productBaseId,
                materialId: item.materialId,
                lockedBasePrice: item.lockedBasePrice,
                lockedMaterialPrice: item.lockedMaterialPrice,
                itemTotalPrice: item.itemTotalPrice,
                components: {
                  create: item.components.map((comp) => ({
                    componentId: comp.componentId,
                    quantity: comp.quantity,
                    lockedPricePerUnit: comp.lockedPricePerUnit,
                    lockedSubTotal: comp.lockedSubTotal,
                  })),
                },
              })),
            },
          },
          include: {
            userDesign: true,
            items: {
              include: {
                productBase: {
                  select: { productName: true, sku: true },
                },
                material: {
                  select: { materialName: true, materialSku: true },
                },
                components: {
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

        const deliveryLabel =
          createdOrder.deliveryType === DeliveryType.DELIVERY
            ? "Delivery"
            : "Pickup";
        const itemCount = createdOrder.items.length;
        const userNotificationTitle = "Pesanan berhasil dibuat";
        const userNotificationMessage = [
          `Order ${createdOrder.orderNumber ?? createdOrder.id} berhasil dibuat.`,
          `Status saat ini: ${createdOrder.status}.`,
          `Metode: ${deliveryLabel}.`,
          `Total item: ${itemCount}.`,
          "Silakan selesaikan pembayaran DP agar produksi dapat dimulai.",
        ].join(" ");

        const adminNotificationTitle = "Pesanan baru masuk";
        const adminNotificationMessage = [
          `Pesanan baru ${createdOrder.orderNumber ?? createdOrder.id} dari ${user.firstName}.`,
          `Status: ${createdOrder.status}.`,
          `Metode: ${deliveryLabel}.`,
          `Total item: ${itemCount}.`,
          `Grand total: ${this.formatCurrency(createdOrder.grandTotalPrice)}.`,
          "Menunggu pembayaran DP dari customer.",
        ].join(" ");

        const notificationResult = await Promise.allSettled([
          this.notificationService.createNotification({
            title: userNotificationTitle,
            message: userNotificationMessage,
            role: Role.USER,
            targetUserId: authUserId,
          }),
          this.notificationService.createNotification({
            title: adminNotificationTitle,
            message: adminNotificationMessage,
            role: Role.ADMIN,
            targetUserId: null,
          }),
        ]);
        notificationResult.forEach((result, index) => {
          if (result.status === "rejected") {
            const target = index === 0 ? "USER" : "ADMIN";
            console.error(
              `[Order ${createdOrder.id}] Failed to create ${target} notification:`,
              result.reason,
            );
          }
        });

        if (user.email) {
          const productRows = createdOrder.items.map((item, index) => {
            const componentTotal = item.components.reduce(
              (sum, component) => sum + component.lockedSubTotal,
              0,
            );
            const componentSummary =
              item.components.length > 0
                ? item.components
                    .map((component) => {
                      const componentName =
                        component.productComponent?.componentName ??
                        component.componentId;
                      const componentPrice = this.formatCurrency(
                        component.lockedPricePerUnit,
                      );
                      return `${componentName} x${component.quantity} (${componentPrice})`;
                    })
                    .join(", ")
                : "-";

            return {
              no: index + 1,
              productName: item.productBase.productName,
              sku: item.productBase.sku,
              materialName: item.material?.materialName ?? "-",
              materialSku: item.material?.materialSku ?? "-",
              components: componentSummary,
              basePrice: this.formatCurrency(item.lockedBasePrice),
              materialPrice: this.formatCurrency(item.lockedMaterialPrice),
              componentPrice: this.formatCurrency(componentTotal),
              itemTotalPrice: this.formatCurrency(item.itemTotalPrice),
            };
          });

          const addressLines =
            deliveryType === DeliveryType.DELIVERY && address
              ? [
                  `${address.recipientName} (${address.phoneNumber})`,
                  `${address.line1}${address.line2 ? `, ${address.line2}` : ""}`,
                  `${address.subdistrict ? `${address.subdistrict}, ` : ""}${address.district}, ${address.city}`,
                  `${address.province}, ${address.postalCode}`,
                  address.country,
                ]
              : ["Pickup at store"];

          try {
            await this.mailService.sendSuccessfulOrderCreation(user.email, {
              firstName: user.firstName,
              orderNumber: createdOrder.orderNumber ?? "-",
              orderId: createdOrder.id,
              orderStatus: createdOrder.status,
              createdAt: this.formatDateTime(createdOrder.createdAt),
              deliveryType:
                createdOrder.deliveryType === DeliveryType.DELIVERY
                  ? "Delivery"
                  : "Pickup",
              deliveryDistance:
                typeof createdOrder.deliveryDistance === "number"
                  ? `${createdOrder.deliveryDistance.toFixed(2)} km`
                  : "-",
              totalWeight: `${Number(createdOrder.totalWeight).toFixed(2)} kg`,
              addressLines,
              notes: createdOrder.notes?.trim() || "-",
              previewUrl: createdOrder.previewUrl || null,
              productRows,
              subtotalPrice: this.formatCurrency(createdOrder.subtotalPrice),
              deliveryFee: this.formatCurrency(createdOrder.deliveryFee ?? 0),
              grandTotalPrice: this.formatCurrency(
                createdOrder.grandTotalPrice,
              ),
            });
          } catch (mailError) {
            console.error(
              `[Order ${createdOrder.id}] Failed to send order creation email:`,
              mailError,
            );
          }
        }

        return createdOrder;
      } catch (error) {
        const isOrderNumberConflict =
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002" &&
          Array.isArray(error.meta?.target) &&
          error.meta.target.includes("orderNumber");

        if (isOrderNumberConflict && attempt < maxOrderNumberRetry) {
          continue;
        }

        throw error;
      }
    }

    throw new ApiError("Failed to generate unique order number", 500);
  };

  getOrder = async (authUserId: number, orderId: string) => {
    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      include: { addresses: { where: { deletedAt: null } } },
    });
    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }
    const order = await this.prisma.customOrder.findFirst({
      where: { id: orderId, userId: authUserId, deletedAt: null },
      include: { items: { include: { components: true } } },
    });
    if (!order) {
      throw new ApiError("We couldn't find your order", 404);
    }
    return order;
  };

  getOrders = async (authUserId: number, query: GetOrdersQueryDTO) => {
    const { status } = query;

    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      include: { addresses: { where: { deletedAt: null } } },
    });
    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("We couldn't find your account", 404);
    }
    const orders = await this.prisma.customOrder.findMany({
      where: {
        userId: authUserId,
        ...(status ? { status: status as OrderStatus } : {}),
      },
      include: { items: { include: { components: true } } },
    });
    return orders;
  };

  getAdminOrders = async (query: GetAdminOrdersQueryDTO) => {
    const { page, perPage, sortBy, orderBy, status, dateFrom, dateTo } = query;

    if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
      throw new ApiError("dateFrom cannot be greater than dateTo", 400);
    }

    const allowedSortBy = new Set([
      "id",
      "orderNumber",
      "status",
      "deliveryType",
      "grandTotalPrice",
      "totalAmountPaid",
      "remainingAmount",
      "createdAt",
      "updatedAt",
    ]);

    if (!allowedSortBy.has(sortBy)) {
      throw new ApiError("sortBy is not valid for orders", 400);
    }

    const skip = (page - 1) * perPage;
    const where: Prisma.CustomOrderWhereInput = {
      deletedAt: null,
      ...(status ? { status } : {}),
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
      this.prisma.customOrder.count({ where }),
      this.prisma.customOrder.findMany({
        where,
        skip,
        take: perPage,
        orderBy: {
          [sortBy]: orderBy,
        } as Prisma.CustomOrderOrderByWithRelationInput,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          items: {
            include: {
              components: true,
            },
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

  processOrder = async (orderId: string) => {
    const order = await this.prisma.customOrder.findFirst({
      where: { id: orderId, deletedAt: null },
      select: {
        id: true,
        orderNumber: true,
        userId: true,
        status: true,
      },
    });

    if (!order) {
      throw new ApiError("Order not found", 404);
    }

    if (order.status !== OrderStatus.AWAITING_PRODUCTION) {
      throw new ApiError(
        `Only orders with status ${OrderStatus.AWAITING_PRODUCTION} can be processed`,
        400,
      );
    }

    const updatedOrder = await this.prisma.customOrder.update({
      where: { id: orderId },
      data: { status: OrderStatus.IN_PRODUCTION },
      include: { items: { include: { components: true } } },
    });

    const orderRef = updatedOrder.orderNumber ?? updatedOrder.id;
    const notificationResults = await Promise.allSettled([
      this.notificationService.createNotification({
        title: "Produksi dimulai",
        message: `Order ${orderRef} mulai diproduksi. Status kini: ${OrderStatus.IN_PRODUCTION}.`,
        role: Role.USER,
        targetUserId: updatedOrder.userId,
      }),
      this.notificationService.createNotification({
        title: "Order diproses produksi",
        message: `Order ${orderRef} telah dipindahkan ke status ${OrderStatus.IN_PRODUCTION}.`,
        role: Role.ADMIN,
        targetUserId: null,
      }),
    ]);

    notificationResults.forEach((result, index) => {
      if (result.status === "rejected") {
        const target = index === 0 ? "USER" : "ADMIN";
        console.error(
          `[Order ${updatedOrder.id}] Failed to create ${target} process-order notification:`,
          result.reason,
        );
      }
    });

    return updatedOrder;
  };
}
