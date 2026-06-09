import { AlertStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { NotFoundError } from "../utils/errors";

/**
 * Retorna todas las alertas de stock, opcionalmente filtradas por estado.
 */
export const findAlerts = async (status?: string) => {
  const where: { status?: AlertStatus } = {};
  if (status) {
    where.status = status as AlertStatus;
  }

  return prisma.stockAlert.findMany({
    where,
    include: {
      product: { select: { id: true, name: true, sku: true, minStock: true } },
      location: { select: { id: true, name: true, type: true } },
    },
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Marca una alerta como resuelta manualmente.
 * Lanza NotFoundError si la alerta no existe.
 */
export const resolveAlertById = async (id: string) => {
  const alert = await prisma.stockAlert.findUnique({ where: { id } });

  if (!alert) {
    throw new NotFoundError("Alerta", id);
  }

  return prisma.stockAlert.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });
};
