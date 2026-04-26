// ============================================================
// Servicio: Stock
// Lógica de negocio para consultar niveles de inventario
// ============================================================

import prisma from "../prisma/client";
import { AppError } from "../utils/AppError";

/**
 * Devuelve todo el stock actual del sistema, con información
 * de producto y ubicación incluida.
 */
export const getAllStock = async () => {
  const stocks = await prisma.stock.findMany({
    orderBy: { quantity: "asc" }, // Primero los más bajos (más críticos)
    include: {
      product: {
        select: { id: true, name: true, sku: true },
      },
      location: {
        select: { id: true, name: true, type: true },
      },
    },
  });

  return stocks;
};

/**
 * Devuelve el stock de una ubicación específica.
 * @throws AppError 404 si la ubicación no existe
 */
export const getStockByLocation = async (locationId: string) => {
  // Validar que la ubicación existe
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

  return { location, stocks };
};
