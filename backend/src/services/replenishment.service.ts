import { ReplenishmentStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { NotFoundError, ConflictError } from "../utils/errors";
import * as eventService from "./event.service";

// ── Proveedores ────────────────────────────────────────────────────────────────

export const findSuppliers = async () =>
  prisma.supplier.findMany({ orderBy: { name: "asc" } });

export const createSupplierRecord = async (data: {
  name: string;
  email: string;
  phone?: string;
}) => prisma.supplier.create({ data });

// ── Órdenes de Reposición ──────────────────────────────────────────────────────

export const findReplenishmentOrders = async () =>
  prisma.replenishmentOrder.findMany({
    include: {
      product: { select: { id: true, name: true, sku: true } },
      location: { select: { id: true, name: true, type: true } },
      supplier: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

export const createOrder = async (dto: {
  productId: string;
  locationId: string;
  supplierId: string;
  quantity: number;
}) => {
  const [product, location, supplier] = await Promise.all([
    prisma.product.findUnique({ where: { id: dto.productId } }),
    prisma.location.findUnique({ where: { id: dto.locationId } }),
    prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
  ]);

  if (!product) throw new NotFoundError("Producto", dto.productId);
  if (!location) throw new NotFoundError("Ubicación", dto.locationId);
  if (!supplier) throw new NotFoundError("Proveedor", dto.supplierId);

  return prisma.replenishmentOrder.create({
    data: { ...dto, status: "ORDERED" },
    include: {
      product: { select: { name: true, sku: true } },
      location: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });
};

export const updateOrderStatus = async (id: string, status: string) => {
  const order = await prisma.replenishmentOrder.findUnique({
    where: { id },
    include: { product: true, location: true },
  });

  if (!order) throw new NotFoundError("Orden de reposición", id);

  if (order.status === "RECEIVED" || order.status === "CANCELLED") {
    throw new ConflictError(
      `No se puede cambiar el estado de una orden en estado final: ${order.status}`
    );
  }

  if (status === "RECEIVED") {
    return prisma.$transaction(async (tx) => {
      const stock = await tx.stock.upsert({
        where: { productId_locationId: { productId: order.productId, locationId: order.locationId } },
        create: { productId: order.productId, locationId: order.locationId, quantity: order.quantity },
        update: { quantity: { increment: order.quantity } },
      });

      await tx.movement.create({
        data: {
          productId: order.productId,
          locationId: order.locationId,
          type: "IN",
          quantity: order.quantity,
          note: `Ingreso automático por orden de reposición ${id.slice(0, 8)}`,
        },
      });

      const updatedOrder = await tx.replenishmentOrder.update({
        where: { id },
        data: { status: "RECEIVED" },
        include: {
          product: { select: { name: true, sku: true, minStock: true } },
          location: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      });

      if (stock.quantity > order.product.minStock) {
        await tx.stockAlert.updateMany({
          where: { productId: order.productId, locationId: order.locationId, status: "PENDING" },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
      }

      return updatedOrder;
    }).then((updatedOrder) => {
      void eventService.emitStockMovement({
        eventType: "stock_received",
        sku: order.product.sku,
        locationId: order.locationId,
        quantity: order.quantity,
        unitPrice: order.product.price ?? undefined,
        category: order.product.category ?? undefined,
        unit: order.product.unit ?? undefined,
        productName: order.product.name,
        movementId: undefined,
        receivedAt: new Date().toISOString(),
      });
      return updatedOrder;
    });
  }

  return prisma.replenishmentOrder.update({
    where: { id },
    data: { status: status as ReplenishmentStatus },
    include: {
      product: { select: { name: true, sku: true } },
      location: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });
};

// ── Reposición inteligente ────────────────────────────────────────────────────

export interface ReplenishmentSuggestion {
  alertId: string;
  productId: string;
  sku: string;
  productName: string;
  locationId: string;
  locationName: string;
  currentStock: number;
  minStock: number;
  stockDisponible: number;
  suggestedQuantity: number;
  suggestedSupplierId: string | null;
  suggestedSupplierName: string | null;
  reason: string;
}

const suggestQuantity = (minStock: number, stockDisponible: number): number =>
  Math.max(1, minStock * 2 - stockDisponible);

export const getReplenishmentSuggestions = async (
  locationId?: string
): Promise<ReplenishmentSuggestion[]> => {
  const alerts = await prisma.stockAlert.findMany({
    where: {
      status: "PENDING",
      ...(locationId ? { locationId } : {}),
    },
    include: {
      product: true,
      location: true,
    },
  });

  if (alerts.length === 0) return [];

  const reservedAgg = await prisma.reservation.groupBy({
    by: ["sku", "locationId"],
    where: { status: "ACTIVE" },
    _sum: { quantity: true },
  });
  const reservedMap = new Map(
    reservedAgg.map((r) => [`${r.sku}:${r.locationId}`, r._sum.quantity ?? 0])
  );

  const suggestions: ReplenishmentSuggestion[] = [];

  for (const alert of alerts) {
    const stock = await prisma.stock.findUnique({
      where: {
        productId_locationId: {
          productId: alert.productId,
          locationId: alert.locationId,
        },
      },
    });

    const reserved =
      reservedMap.get(`${alert.product.sku}:${alert.locationId}`) ?? 0;
    const quantity = stock?.quantity ?? alert.currentStock;
    const stockDisponible = quantity - reserved;

    const lastOrder = await prisma.replenishmentOrder.findFirst({
      where: { productId: alert.productId, locationId: alert.locationId },
      orderBy: { createdAt: "desc" },
      include: { supplier: { select: { id: true, name: true } } },
    });

    let suggestedSupplierId: string | null = lastOrder?.supplierId ?? null;
    let suggestedSupplierName: string | null = lastOrder?.supplier.name ?? null;

    if (!suggestedSupplierId) {
      const firstSupplier = await prisma.supplier.findFirst({
        orderBy: { name: "asc" },
      });
      suggestedSupplierId = firstSupplier?.id ?? null;
      suggestedSupplierName = firstSupplier?.name ?? null;
    }

    suggestions.push({
      alertId: alert.id,
      productId: alert.productId,
      sku: alert.product.sku,
      productName: alert.product.name,
      locationId: alert.locationId,
      locationName: alert.location.name,
      currentStock: quantity,
      minStock: alert.product.minStock,
      stockDisponible,
      suggestedQuantity: suggestQuantity(alert.product.minStock, stockDisponible),
      suggestedSupplierId,
      suggestedSupplierName,
      reason: `Stock (${stockDisponible} disp.) bajo umbral (${alert.product.minStock})`,
    });
  }

  return suggestions;
};

export const createProposal = async (dto: {
  productId: string;
  locationId: string;
  supplierId: string;
  quantity: number;
}) => {
  const [product, location, supplier] = await Promise.all([
    prisma.product.findUnique({ where: { id: dto.productId } }),
    prisma.location.findUnique({ where: { id: dto.locationId } }),
    prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
  ]);

  if (!product) throw new NotFoundError("Producto", dto.productId);
  if (!location) throw new NotFoundError("Ubicación", dto.locationId);
  if (!supplier) throw new NotFoundError("Proveedor", dto.supplierId);

  return prisma.replenishmentOrder.create({
    data: { ...dto, status: "PROPOSED" },
    include: {
      product: { select: { name: true, sku: true } },
      location: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });
};

export const approveProposal = async (id: string) => {
  const order = await prisma.replenishmentOrder.findUnique({ where: { id } });
  if (!order) throw new NotFoundError("Orden de reposición", id);

  if (order.status !== "PROPOSED") {
    throw new ConflictError(
      `Solo se pueden aprobar propuestas en estado PROPOSED. Actual: ${order.status}`
    );
  }

  return updateOrderStatus(id, "ORDERED");
};

export type DemandScenario = "normal" | "peak" | "low";

const SCENARIO_FACTOR: Record<DemandScenario, number> = {
  normal: 1,
  peak: 1.5,
  low: 0.7,
};

export const simulateDemand = async (dto: {
  sku: string;
  locationId: string;
  horizonDays?: number;
  scenario?: DemandScenario;
}) => {
  const sku = dto.sku.trim().toUpperCase();
  const horizonDays = dto.horizonDays ?? 30;
  const scenario = dto.scenario ?? "normal";

  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) throw new NotFoundError("Producto (SKU)", sku);

  const location = await prisma.location.findUnique({
    where: { id: dto.locationId },
  });
  if (!location) throw new NotFoundError("Ubicación", dto.locationId);

  const since = new Date();
  since.setDate(since.getDate() - 90);

  const outMovements = await prisma.movement.findMany({
    where: {
      productId: product.id,
      locationId: dto.locationId,
      type: "OUT",
      createdAt: { gte: since },
    },
    select: { quantity: true, createdAt: true },
  });

  const totalOut = outMovements.reduce((sum, m) => sum + m.quantity, 0);
  const daysWithData = Math.max(
    1,
    Math.ceil((Date.now() - since.getTime()) / (1000 * 60 * 60 * 24))
  );
  const avgDailyDemand = (totalOut / daysWithData) * SCENARIO_FACTOR[scenario];

  const stock = await prisma.stock.findUnique({
    where: {
      productId_locationId: { productId: product.id, locationId: dto.locationId },
    },
  });

  const reservedAgg = await prisma.reservation.aggregate({
    where: { sku, locationId: dto.locationId, status: "ACTIVE" },
    _sum: { quantity: true },
  });
  const reserved = reservedAgg._sum.quantity ?? 0;
  const quantity = stock?.quantity ?? 0;
  const stockDisponible = quantity - reserved;

  const daysUntilStockout =
    avgDailyDemand > 0 ? Math.floor(stockDisponible / avgDailyDemand) : null;

  const projectedDemand = Math.ceil(avgDailyDemand * horizonDays);
  const recommendedOrderQty = Math.max(
    0,
    suggestQuantity(product.minStock, stockDisponible - projectedDemand)
  );

  const stockoutDate =
    daysUntilStockout !== null
      ? new Date(Date.now() + daysUntilStockout * 24 * 60 * 60 * 1000)
      : null;

  return {
    sku,
    productName: product.name,
    locationId: dto.locationId,
    locationName: location.name,
    horizonDays,
    scenario,
    stockDisponible,
    minStock: product.minStock,
    avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
    projectedDemandHorizon: projectedDemand,
    daysUntilStockout,
    stockoutDate,
    recommendedOrderQty,
    historicalOutUnits: totalOut,
    historicalDays: daysWithData,
  };
};
