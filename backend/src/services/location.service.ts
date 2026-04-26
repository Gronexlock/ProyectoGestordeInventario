// ============================================================
// Servicio: Locations (Ubicaciones)
// Toda la lógica de negocio relacionada con ubicaciones
// ============================================================

import prisma from "../prisma/client";
import { CreateLocationDto } from "../utils/types";
import { AppError } from "../utils/AppError";

/**
 * Crea una nueva ubicación en la base de datos.
 * @throws AppError 400 si el nombre ya existe
 */
export const createLocation = async (dto: CreateLocationDto) => {
  // Verificar que no existe otra ubicación con el mismo nombre
  const existing = await prisma.location.findFirst({
    where: { name: dto.name },
  });

  if (existing) {
    throw new AppError(
      `Ya existe una ubicación con el nombre "${dto.name}".`,
      409
    );
  }

  const location = await prisma.location.create({
    data: {
      name: dto.name,
      type: dto.type,
      capacity: dto.capacity,
    },
  });

  return location;
};

/**
 * Obtiene todas las ubicaciones con su stock asociado.
 */
export const getAllLocations = async () => {
  const locations = await prisma.location.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      // Incluir resumen de stock por ubicación
      stocks: {
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
    },
  });

  return locations;
};
