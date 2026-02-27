import {
  DeliveryType,
  Prisma,
  PrismaClient,
} from "../../../generated/prisma/client.js";
import { CreateOrderDTO } from "./dto/createOrder.dto.js";
import { ApiError } from "../../utils/api-error.js";
import {
  RAJAONGKIR_API_COST_KEY,
  RAJAONGKIR_ORIGIN_SUBDISTRICT_ID,
  STORE_LATITUDE,
  STORE_LONGITUDE,
} from "../../config/env.js";

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

  constructor(private prisma: PrismaClient) {}

  // ── Helpers ─────────────────────────────────────────────────────────────────

  /**
   * Strip instance suffix from model id.
   * "cmlsujgx70008fgvtwbc0myzs_1" → "cmlsujgx70008fgvtwbc0myzs"
   */
  private stripInstanceSuffix = (modelId: string): string => {
    return modelId.replace(/_\d+$/, "");
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
      const materialId = model.texture
        ? this.stripInstanceSuffix(model.texture)
        : null;

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
      if (materialId) {
        const material = await this.prisma.productMaterials.findFirst({
          where: { id: materialId, isActive: true, deletedAt: null },
        });
        if (!material) {
          throw new ApiError(
            `Material not found or inactive: ${materialId}`,
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
    weightGrams: number,
  ) => {
    if (!RAJAONGKIR_API_COST_KEY) {
      throw new ApiError("RajaOngkir cost key is not configured", 500);
    }

    const originSubdistrictId =
      RAJAONGKIR_ORIGIN_SUBDISTRICT_ID ?? this.DEFAULT_ORIGIN_SUBDISTRICT_ID;
    const billableWeightGrams = Math.max(1, Math.ceil(weightGrams));

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

    const user = await this.prisma.user.findUnique({
      where: { id: authUserId },
      select: { id: true, accountStatus: true, deletedAt: true },
    });

    if (!user || user.deletedAt || user.accountStatus !== "ACTIVE") {
      throw new ApiError("User account not found or inactive", 404);
    }

    let design = null as Awaited<
      ReturnType<typeof this.prisma.userDesign.findFirst>
    >;
    let resolvedConfiguration: Prisma.InputJsonValue;
    let designSnapshot: Prisma.InputJsonValue;

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

    const address = await this.prisma.address.findFirst({
      where: {
        id: addressId,
        userId: authUserId,
      },
    });

    if (!address) {
      throw new ApiError("Shipping address not found", 404);
    }

    if (
      deliveryType === DeliveryType.DELIVERY &&
      !address.komerceSubdistrictId
    ) {
      throw new ApiError(
        "Address komerceSubdistrictId is required for delivery calculation. Please re-save this address.",
        400,
      );
    }

    const snapShotAddress = {
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
    };

    const { lockedItems, subtotalPrice, totalWeight } =
      await this.calculatePricingFromDesign(resolvedConfiguration);

    const deliveryFee =
      deliveryType === DeliveryType.PICKUP
        ? 0
        : await this.calculateDeliveryFee(
            address.komerceSubdistrictId as string,
            totalWeight,
          );
    const deliveryDistance =
      deliveryType === DeliveryType.PICKUP
        ? null
        : this.calculateDeliveryDistanceKm(address.latitude, address.longitude);
    const grandTotalPrice = subtotalPrice + deliveryFee;

    return await this.prisma.customOrder.create({
      data: {
        userId: authUserId,
        userDesignId: design?.id,
        designSnapShot: designSnapshot,
        addressId: address.id,
        snapShotAddress,
        deliveryType: deliveryType,
        subtotalPrice,
        totalWeight: Math.ceil(totalWeight),
        deliveryDistance,
        deliveryFee,
        status: "PENDING_PAYMENT",
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
      },
    });
  };
}
