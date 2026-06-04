// ============================================================
// Servicio: Stock
// Lógica de negocio para consultar niveles de inventario
// y helpers de reserva para pedidos
// ============================================================

import prisma from "../prisma/client";
import { Prisma } from "@prisma/client";
import { AppError } from "../utils/AppError";
import { getActiveReservedQuantity } from "./reservation.service";

export interface StockWithAvailability {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  reserved: number;
  stockDisponible: number;
  product: { id: string; name: string; sku: string };
  location: { id: string; name: string; type: string };
}

const enrichStockRecord = async (stock: {
  id: string;
  productId: string;
  locationId: string;
  quantity: number;
  product: { id: string; name: string; sku: string };
  location: { id: string; name: string; type: string };
}): Promise<StockWithAvailability> => {
  const reserved = await getActiveReservedQuantity(
    stock.product.sku,
    stock.locationId
  );

  return {
    ...stock,
    reserved,
    stockDisponible: stock.quantity - reserved,
  };
};

// Tipo del cliente de transacción Prisma
type TxClient = Prisma.TransactionClient;

// Ítem mínimo necesario para operar reservas
interface StockItem {
  productId: string;
  locationId: string;
  quantity: number;
}

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
 * Devuelve todo el stock actual del sistema, con información
 * de producto, ubicación y stock disponible (quantity − reservado).
 */
export const getAllStock = async (): Promise<StockWithAvailability[]> => {
  const stocks = await prisma.stock.findMany({
    orderBy: { quantity: "asc" },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
      location: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  return Promise.all(stocks.map(enrichStockRecord));
};

/**
 * Devuelve el stock de una ubicación específica con stock disponible.
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

  const stocks = await prisma.stock.findMany({
    where: { locationId },
    orderBy: { quantity: "asc" },
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
      location: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  const enriched = await Promise.all(stocks.map(enrichStockRecord));

  return { location, stocks: enriched };
};
