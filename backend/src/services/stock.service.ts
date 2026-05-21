// ============================================================
// Servicio: Stock
// Lógica de negocio para consultar niveles de inventario
// ============================================================

import prisma from "../prisma/client";
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
