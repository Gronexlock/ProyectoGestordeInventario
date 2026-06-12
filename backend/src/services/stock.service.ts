// ============================================================
// Servicio: Stock
// Lógica de negocio para consultar niveles de inventario
// y helpers de reserva para pedidos
// ============================================================

import prisma from "../prisma/client";
import { Prisma, ReservationStatus } from "@prisma/client";
import { AppError } from "../utils/AppError";

export interface StockWithAvailability {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  reserved: number;
  stockDisponible: number;
  product: { id: string; name: string; sku: string; minStock: number };
  location: { id: string; name: string; type: string };
}

// Tipo del cliente de transacción Prisma
type TxClient = Prisma.TransactionClient;

// Ítem mínimo necesario para operar reservas
interface StockItem {
  productId: string;
  locationId: string;
  quantity: number;
}

/**
 * Construye un Map de "sku:locationId" → cantidad reservada activa.
 * Ejecuta un único groupBy (una sola query) para eliminar el patrón N+1.
 */
const buildReservedMap = async (filter?: {
  sku?: string;
  locationId?: string;
}): Promise<Map<string, number>> => {
  const agg = await prisma.reservation.groupBy({
    by: ["sku", "locationId"],
    where: {
      status: ReservationStatus.ACTIVE,
      ...(filter?.sku && { sku: filter.sku }),
      ...(filter?.locationId && { locationId: filter.locationId }),
    },
    _sum: { quantity: true },
  });
  return new Map(agg.map((r) => [`${r.sku}:${r.locationId}`, r._sum.quantity ?? 0]));
};

// ── Helpers de reserva (solo para uso interno desde OrderService) ─

/**
 * Reserva stock para una lista de ítems dentro de una transacción.
 * Valida disponibilidad (quantity - reserved) antes de incrementar.
 * Si cualquier ítem falla, el rollback es automático.
 */
export const reserveStock = async (
  tx: TxClient,
  items: StockItem[]
): Promise<void> => {
  for (const item of items) {
    const stock = await tx.stock.findUnique({
      where: {
        productId_locationId: {
          productId: item.productId,
          locationId: item.locationId,
        },
      },
    });

    if (!stock) {
      throw new AppError(
        `No existe stock para el producto "${item.productId}" en la ubicación "${item.locationId}".`,
        400
      );
    }

    const available = stock.quantity - stock.reserved;

    if (available < item.quantity) {
      throw new AppError(
        `Stock insuficiente para el producto "${item.productId}" en ubicación "${item.locationId}". ` +
          `Disponible: ${available} unidades, solicitado: ${item.quantity}.`,
        400
      );
    }

    await tx.stock.update({
      where: {
        productId_locationId: {
          productId: item.productId,
          locationId: item.locationId,
        },
      },
      data: { reserved: { increment: item.quantity } },
    });
  }
};

/**
 * Libera reservas de stock para una lista de ítems dentro de una transacción.
 * Se usa al cancelar un pedido en estado RESERVED o READY_FOR_DISPATCH.
 */
export const releaseStock = async (
  tx: TxClient,
  items: StockItem[]
): Promise<void> => {
  for (const item of items) {
    await tx.stock.update({
      where: {
        productId_locationId: {
          productId: item.productId,
          locationId: item.locationId,
        },
      },
      data: { reserved: { decrement: item.quantity } },
    });
  }
};

/**
 * Convierte reservas en salidas efectivas de stock.
 * Decrementa quantity y reserved, y crea un Movement OUT por ítem.
 * Se usa al transicionar un pedido a IN_TRANSIT.
 */
export const deductStock = async (
  tx: TxClient,
  items: StockItem[],
  orderId: string
): Promise<void> => {
  for (const item of items) {
    await tx.stock.update({
      where: {
        productId_locationId: {
          productId: item.productId,
          locationId: item.locationId,
        },
      },
      data: {
        quantity: { decrement: item.quantity },
        reserved: { decrement: item.quantity },
      },
    });

    await tx.movement.create({
      data: {
        productId: item.productId,
        locationId: item.locationId,
        type: "OUT",
        quantity: item.quantity,
        note: `Despacho pedido ${orderId}`,
      },
    });
  }
};

/**
 * Devuelve todo el stock actual del sistema con stock disponible calculado.
 * Usa una sola query de agregación para reservas (sin patrón N+1).
 */
export const getAllStock = async (): Promise<StockWithAvailability[]> => {
  const [stocks, reservedMap] = await Promise.all([
    prisma.stock.findMany({
      orderBy: { quantity: "asc" },
      include: {
        product: {
          select: { id: true, name: true, sku: true, minStock: true },
        },
        location: {
          select: { id: true, name: true, type: true },
        },
      },
    }),
    buildReservedMap(),
  ]);

  return stocks.map((stock) => {
    const reserved = reservedMap.get(`${stock.product.sku}:${stock.locationId}`) ?? 0;
    return { ...stock, reserved, stockDisponible: stock.quantity - reserved };
  });
};

/**
 * Devuelve el stock de una ubicación específica con stock disponible.
 * Usa una sola query de agregación para reservas (sin patrón N+1).
 * @throws AppError 404 si la ubicación no existe
 */
export const getStockByLocation = async (locationId: string) => {
  const location = await prisma.location.findUnique({
    where: { id: locationId },
  });

  if (!location) {
    throw new AppError(
      `No se encontró una ubicación con ID "${locationId}".`,
      404
    );
  }

  const [stocks, reservedMap] = await Promise.all([
    prisma.stock.findMany({
      where: { locationId },
      orderBy: { quantity: "asc" },
      include: {
        product: {
          select: { id: true, name: true, sku: true, minStock: true },
        },
        location: {
          select: { id: true, name: true, type: true },
        },
      },
    }),
    buildReservedMap({ locationId }),
  ]);

  const enriched: StockWithAvailability[] = stocks.map((stock) => {
    const reserved = reservedMap.get(`${stock.product.sku}:${stock.locationId}`) ?? 0;
    return { ...stock, reserved, stockDisponible: stock.quantity - reserved };
  });

  return { location, stocks: enriched };
};

/**
 * Sugiere ubicaciones fuente ordenadas por prioridad y stock disponible.
 * SCRUM-69: implementa reglas de prioridad de ubicaciones.
 * Usa una sola query de agregación para reservas (sin patrón N+1).
 *
 * @param productId UUID del producto
 * @param quantity  Cantidad mínima requerida (opcional, default 1)
 * @throws AppError 404 si el producto no existe
 */
export const suggestSourceLocation = async (
  productId: string,
  quantity = 1
): Promise<Array<{
  location: { id: string; name: string; type: string; priority: number };
  quantity: number;
  reserved: number;
  stockDisponible: number;
  rank: number;
}>> => {
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) {
    throw new AppError(`No se encontró un producto con ID "${productId}".`, 404);
  }

  const [stocks, reservedMap] = await Promise.all([
    prisma.stock.findMany({
      where: { productId },
      include: {
        location: {
          select: { id: true, name: true, type: true, priority: true },
        },
      },
    }),
    buildReservedMap({ sku: product.sku }),
  ]);

  const enriched = stocks.map((s) => {
    const reserved = reservedMap.get(`${product.sku}:${s.locationId}`) ?? 0;
    const stockDisponible = s.quantity - reserved;
    return { location: s.location, quantity: s.quantity, reserved, stockDisponible };
  });

  const filtered = enriched.filter((s) => s.stockDisponible >= quantity);
  filtered.sort((a, b) => {
    if (a.location.priority !== b.location.priority) {
      return a.location.priority - b.location.priority;
    }
    return b.stockDisponible - a.stockDisponible;
  });

  return filtered.map((s, idx) => ({ ...s, rank: idx + 1 }));
};
