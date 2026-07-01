// ============================================================
// Servicio: Movements (Movimientos de Inventario)
// ============================================================

import prisma from "../prisma/client";
import { CreateMovementDto, MovementResult } from "../utils/types";
import { AppError } from "../utils/AppError";
import { logger } from "../config/logger";
import * as eventService from "./event.service";

/**
 * Registra un movimiento de inventario (entrada o salida) y
 * actualiza el stock correspondiente de forma atómica.
 */
export const createMovement = async (
  dto: CreateMovementDto
): Promise<MovementResult> => {
  // ── 1. Validar que existen producto y ubicación ───────────────
  const [product, location] = await Promise.all([
    prisma.product.findUnique({ where: { id: dto.productId } }),
    prisma.location.findUnique({ where: { id: dto.locationId } }),
  ]);

  if (!product) {
    throw new AppError(`No se encontró un producto con ID "${dto.productId}".`, 404);
  }

  if (!location) {
    throw new AppError(`No se encontró una ubicación con ID "${dto.locationId}".`, 404);
  }

  // ── 2. Validar cantidad positiva ──────────────────────────────
  if (dto.quantity <= 0) {
    throw new AppError("La cantidad del movimiento debe ser mayor a cero.", 400);
  }

  // ── 3. Validar horario de despacho (salidas) ─────────
  if (dto.type === "OUT") {
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTime = (timeStr: string) => {
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    };

    const startMinutes = parseTime(location.dispatchStart);
    const endMinutes = parseTime(location.dispatchEnd);

    if (currentTotalMinutes < startMinutes || currentTotalMinutes > endMinutes) {
      throw new AppError(
        `Operación rechazada: La ubicación "${location.name}" está fuera de su horario de despacho (${location.dispatchStart} a ${location.dispatchEnd}).`,
        400
      );
    }
  }

  // ── 4. Transacción atómica ────────────────────────────────────
  const result = await prisma.$transaction(async (tx) => {
    // 3a. Buscar stock existente para producto+ubicación
    const existingStock = await tx.stock.findUnique({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.locationId,
        },
      },
    });

    const currentQuantity = existingStock?.quantity ?? 0;
    const currentReserved = existingStock?.reserved ?? 0;
    let newQuantity: number;

    if (dto.type === "IN") {
      newQuantity = currentQuantity + dto.quantity;
    } else {
      // OUT: verificar stock libre (físico − reservado)
      const availableQty = currentQuantity - currentReserved;

      if (dto.quantity > availableQty) {
        throw new AppError(
          `Stock libre insuficiente. Disponible: ${availableQty} (Físico: ${currentQuantity}, Reservado: ${currentReserved}). ` +
          `Se intentaron retirar: ${dto.quantity} unidades.`,
          400
        );
      }

      newQuantity = currentQuantity - dto.quantity;
    }

    // 3c. Crear o actualizar el stock (upsert)
    const updatedStock = await tx.stock.upsert({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.locationId,
        },
      },
      create: {
        productId: dto.productId,
        locationId: dto.locationId,
        quantity: newQuantity,
      },
      update: {
        quantity: newQuantity,
      },
    });

    // 3d. Registrar el movimiento
    const movement = await tx.movement.create({
      data: {
        productId: dto.productId,
        locationId: dto.locationId,
        type: dto.type,
        quantity: dto.quantity,
        note: dto.note,
      },
    });

    // 3e. Generar/Resolver Alertas de Stock Crítico de forma persistente
    if (dto.type === "OUT" && newQuantity <= product.minStock) {
      const existingAlert = await tx.stockAlert.findFirst({
        where: {
          productId: dto.productId,
          locationId: dto.locationId,
          status: "PENDING",
        },
      });

      if (!existingAlert) {
        await tx.stockAlert.create({
          data: {
            productId: dto.productId,
            locationId: dto.locationId,
            currentStock: newQuantity,
            minStock: product.minStock,
            status: "PENDING",
          },
        });
      }
    } else if (dto.type === "IN" && newQuantity > product.minStock) {
      await tx.stockAlert.updateMany({
        where: {
          productId: dto.productId,
          locationId: dto.locationId,
          status: "PENDING",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });
    }

    return { movement, updatedStock, newQuantity };
  });

  let alert: string | undefined;
  if (result.newQuantity <= product.minStock) {
    alert = `⚠️ STOCK CRÍTICO: "${product.name}" (SKU: ${product.sku}) en "${location.name}" tiene solo ${result.newQuantity} unidades.`;
    logger.warn("Stock crítico detectado", {
      product: product.name,
      sku: product.sku,
      location: location.name,
      currentStock: result.newQuantity,
      minStock: product.minStock,
    });
  }

  const isAdjustment = dto.note?.includes("Conciliación");
  const eventType =
    dto.type === "IN"
      ? "stock_received"
      : isAdjustment
        ? "stock_adjusted"
        : "stock_dispatched";

  void eventService.emitStockMovement({
    eventType,
    sku: product.sku,
    locationId: dto.locationId,
    quantity: eventType === "stock_adjusted" && dto.type === "OUT" ? -dto.quantity : dto.quantity,
    unitPrice: product.price ?? undefined,
    category: product.category ?? undefined,
    unit: product.unit ?? undefined,
    productName: product.name,
    locationName: location.name,
    locationType: location.type,
    movementId: result.movement.id,
    receivedAt: eventType === "stock_received" ? result.movement.createdAt.toISOString() : undefined,
  });

  if (dto.type === "OUT" && result.newQuantity <= product.minStock) {
    void eventService.emitCriticalThreshold({
      alertId: result.movement.id,
      sku: product.sku,
      locationId: dto.locationId,
      currentStock: result.newQuantity,
      minStock: product.minStock,
      thresholdLimite: product.minStock,
      productName: product.name,
      locationName: location.name,
      locationType: location.type,
      city: location.city ?? undefined,
    });
  }

  return {
    movement: result.movement,
    updatedStock: result.updatedStock,
    alert,
  };
};

/**
 * Registra una transferencia atómica de inventario entre dos ubicaciones.
 */
export const createTransfer = async (dto: {
  productId: string;
  sourceLocationId: string;
  destinationLocationId: string;
  quantity: number;
  note?: string;
}) => {
  // 1. Validaciones
  const [product, sourceLoc, destLoc] = await Promise.all([
    prisma.product.findUnique({ where: { id: dto.productId } }),
    prisma.location.findUnique({ where: { id: dto.sourceLocationId } }),
    prisma.location.findUnique({ where: { id: dto.destinationLocationId } }),
  ]);

  if (!product) throw new AppError("Producto no encontrado.", 404);
  if (!sourceLoc) throw new AppError("Ubicación de origen no encontrada.", 404);
  if (!destLoc) throw new AppError("Ubicación de destino no encontrada.", 404);
  if (dto.sourceLocationId === dto.destinationLocationId) {
    throw new AppError("La ubicación de origen y destino deben ser distintas.", 400);
  }
  if (dto.quantity <= 0) {
    throw new AppError("La cantidad debe ser mayor a cero.", 400);
  }

  // Validar horario de despacho en la origen
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();
  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(":");
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  };

  const startMinutes = parseTime(sourceLoc.dispatchStart);
  const endMinutes = parseTime(sourceLoc.dispatchEnd);

  if (currentTotalMinutes < startMinutes || currentTotalMinutes > endMinutes) {
    throw new AppError(
      `Operación rechazada: La ubicación de origen "${sourceLoc.name}" está fuera de su horario de despacho (${sourceLoc.dispatchStart} a ${sourceLoc.dispatchEnd}).`,
      400
    );
  }

  // 2. Transacción
  return prisma.$transaction(async (tx) => {
    // A. Stock Origen
    const sourceStock = await tx.stock.findUnique({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.sourceLocationId,
        },
      },
    });

    const currentSourceQty = sourceStock?.quantity ?? 0;
    const currentSourceReserved = sourceStock?.reserved ?? 0;
    const availableSource = currentSourceQty - currentSourceReserved;

    if (availableSource < dto.quantity) {
      throw new AppError(
        `Stock disponible insuficiente en "${sourceLoc.name}". ` +
        `Disponible: ${availableSource} (Físico: ${currentSourceQty}, Reservado: ${currentSourceReserved}). ` +
        `Requerido: ${dto.quantity}.`,
        400
      );
    }

    // B. Capacidad Destino
    const destStock = await tx.stock.findUnique({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.destinationLocationId,
        },
      },
    });

    if (destLoc.capacity) {
      const allStocks = await tx.stock.findMany({
        where: { locationId: dto.destinationLocationId },
      });
      const totalDestQty = allStocks.reduce((total, s) => total + s.quantity, 0);

      if (totalDestQty + dto.quantity > destLoc.capacity) {
        throw new AppError(
          `Operación rechazada: La ubicación de destino "${destLoc.name}" no cuenta con capacidad suficiente (Capacidad máxima: ${destLoc.capacity}, Ocupado: ${totalDestQty}).`,
          400
        );
      }
    }

    // C. Actualizar existencias
    const newSourceQty = currentSourceQty - dto.quantity;
    const newDestQty = (destStock?.quantity ?? 0) + dto.quantity;

    await tx.stock.update({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.sourceLocationId,
        },
      },
      data: { quantity: newSourceQty },
    });

    await tx.stock.upsert({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.destinationLocationId,
        },
      },
      create: {
        productId: dto.productId,
        locationId: dto.destinationLocationId,
        quantity: newDestQty,
      },
      update: {
        quantity: newDestQty,
      },
    });

    // D. Registrar movimientos
    const transferNote = dto.note ? `Transferencia: ${dto.note}` : "Transferencia manual";

    const movOut = await tx.movement.create({
      data: {
        productId: dto.productId,
        locationId: dto.sourceLocationId,
        destinationLocationId: dto.destinationLocationId,
        type: "TRANSFER",
        quantity: dto.quantity,
        note: `Salida de transferencia hacia "${destLoc.name}". ${transferNote}`,
      },
    });

    const movIn = await tx.movement.create({
      data: {
        productId: dto.productId,
        locationId: dto.destinationLocationId,
        type: "TRANSFER",
        quantity: dto.quantity,
        note: `Ingreso de transferencia desde "${sourceLoc.name}". ${transferNote}`,
      },
    });

    // E. Generar alertas en origen si aplica
    if (newSourceQty <= product.minStock) {
      const existingAlert = await tx.stockAlert.findFirst({
        where: {
          productId: dto.productId,
          locationId: dto.sourceLocationId,
          status: "PENDING",
        },
      });

      if (!existingAlert) {
        await tx.stockAlert.create({
          data: {
            productId: dto.productId,
            locationId: dto.sourceLocationId,
            currentStock: newSourceQty,
            minStock: product.minStock,
            status: "PENDING",
          },
        });
      }
    }

    // F. Resolver alertas en destino si aplica
    if (newDestQty > product.minStock) {
      await tx.stockAlert.updateMany({
        where: {
          productId: dto.productId,
          locationId: dto.destinationLocationId,
          status: "PENDING",
        },
        data: {
          status: "RESOLVED",
          resolvedAt: new Date(),
        },
      });
    }

    return { movOut, movIn, newSourceQty };
  }).then(async (result) => {
    void eventService.emitStockMovement({
      eventType: "stock_transfer_initiated",
      sku: product.sku,
      locationId: dto.sourceLocationId,
      destinationId: dto.destinationLocationId,
      quantity: dto.quantity,
      unitPrice: product.price ?? undefined,
      category: product.category ?? undefined,
      unit: product.unit ?? undefined,
      productName: product.name,
      locationName: sourceLoc.name,
      locationType: sourceLoc.type,
      movementId: result.movOut.id,
    });

    if (result.newSourceQty <= product.minStock) {
      void eventService.emitCriticalThreshold({
        alertId: result.movOut.id,
        sku: product.sku,
        locationId: dto.sourceLocationId,
        currentStock: result.newSourceQty,
        minStock: product.minStock,
        thresholdLimite: product.minStock,
        productName: product.name,
        locationName: sourceLoc.name,
        locationType: sourceLoc.type,
        city: sourceLoc.city ?? undefined,
      });
    }

    return { movOut: result.movOut, movIn: result.movIn };
  });
};

/**
 * Obtiene el historial de movimientos con detalles de producto y ubicación.
 */
export const getAllMovements = async () => {
  return prisma.movement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      location: { select: { id: true, name: true, type: true } },
    },
  });
};
