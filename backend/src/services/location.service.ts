// ============================================================
// Servicio: Locations (Ubicaciones)
// Toda la lógica de negocio relacionada con ubicaciones
// ============================================================

import prisma from "../prisma/client";
import { CreateLocationDto, UpdateLocationDto } from "../utils/types";
import { AppError } from "../utils/AppError";

/**
 * Crea una nueva ubicación en la base de datos.
 * @throws AppError 409 si el nombre ya existe
 */
export const createLocation = async (dto: CreateLocationDto) => {
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

/**
 * Obtiene una ubicación por su ID.
 * @throws AppError 404 si no existe
 */
export const getLocationById = async (id: string) => {
  const location = await prisma.location.findUnique({
    where: { id },
    include: {
      stocks: {
        include: {
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
      },
    },
  });

  if (!location) {
    throw new AppError(`No se encontró una ubicación con ID "${id}".`, 404);
  }

  return location;
};

/**
 * Actualiza los datos de una ubicación existente.
 * @throws AppError 404 si no existe
 * @throws AppError 409 si el nuevo nombre ya está en uso por otra ubicación
 */
export const updateLocation = async (id: string, dto: UpdateLocationDto) => {
  // Verificar que la ubicación existe
  const existing = await prisma.location.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError(`No se encontró una ubicación con ID "${id}".`, 404);
  }

  // Si se cambia el nombre, verificar que no esté en uso por otra ubicación
  if (dto.name && dto.name !== existing.name) {
    const nameConflict = await prisma.location.findFirst({
      where: { name: dto.name, NOT: { id } },
    });
    if (nameConflict) {
      throw new AppError(
        `Ya existe otra ubicación con el nombre "${dto.name}".`,
        409
      );
    }
  }

  const updated = await prisma.location.update({
    where: { id },
    data: {
      name: dto.name,
      type: dto.type,
      capacity: dto.capacity,
    },
  });

  return updated;
};

/**
 * Elimina una ubicación por su ID.
 * @throws AppError 404 si no existe
 * @throws AppError 409 si tiene stock asociado (no se puede eliminar)
 */
export const deleteLocation = async (id: string) => {
  const existing = await prisma.location.findUnique({
    where: { id },
    include: { stocks: true },
  });

  if (!existing) {
    throw new AppError(`No se encontró una ubicación con ID "${id}".`, 404);
  }

  // Evitar eliminar ubicaciones que tengan stock registrado
  if (existing.stocks.length > 0) {
    throw new AppError(
      `No se puede eliminar la ubicación "${existing.name}" porque tiene ${existing.stocks.length} registro(s) de stock asociado(s).`,
      409
    );
  }

  await prisma.location.delete({ where: { id } });

  return existing;
};
