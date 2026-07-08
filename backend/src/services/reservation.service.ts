// ============================================================
// Servicio: Reservations (Reservas de Stock)
// SCRUM-20: cancelación + liberación en un paso
// SCRUM-33: confirmación de entrega → estado SOLD + movimiento OUT
// ============================================================

import { ReservationStatus, MovementType, Prisma } from "@prisma/client";
import prisma from "../prisma/client";
import { AppError } from "../utils/AppError";
import { config } from "../config/config";
import {
  CreateReservationDto,
  ConfirmDeliveryDto,
  ReleaseReservationDto,
} from "../utils/types";
import { transitionOrder } from "./order.service";
import { suggestSourceLocationBySku } from "./stock.service";
import * as eventService from "./event.service";
import { notifyIncident } from "./incident.service";

/**
 * Suma de unidades reservadas activas para un SKU en una ubicación.
 */
export const getActiveReservedQuantity = async (
  sku: string,
  locationId: string
): Promise<number> => {
  const result = await prisma.reservation.aggregate({
    where: { sku, locationId, status: ReservationStatus.ACTIVE },
    _sum: { quantity: true },
  });

  return result._sum.quantity ?? 0;
};

/**
 * Calcula stock disponible = quantity físico − reservas ACTIVE.
 */
export const getStockDisponible = async (
  sku: string,
  locationId: string
): Promise<{ quantity: number; reserved: number; stockDisponible: number }> => {
  const product = await prisma.product.findUnique({ where: { sku } });

  if (!product) {
    return { quantity: 0, reserved: 0, stockDisponible: 0 };
  }

  const stock = await prisma.stock.findUnique({
    where: {
      productId_locationId: { productId: product.id, locationId },
    },
  });

  const quantity = stock?.quantity ?? 0;
  const reserved = await getActiveReservedQuantity(sku, locationId);

  return {
    quantity,
    reserved,
    stockDisponible: quantity - reserved,
  };
};

/**
 * Mock Proyecto 3 — crea reserva bloqueando stock disponible (no quantity físico).
 * Si no se envía locationId, elige la ubicación óptima automáticamente (Grupo 3).
 */
export const createReservation = async (dto: CreateReservationDto) => {
  const sku = dto.sku.trim().toUpperCase();

  // === 0. VALIDACIÓN TEMPRANA DE CANTIDAD (antes de cualquier query) ===
  if (dto.quantity <= 0) {
    throw new AppError("La cantidad debe ser mayor a cero.", 400);
  }

  const product = await prisma.product.findUnique({ where: { sku } });

  if (!product) {
    throw new AppError(`No se encontró un producto con SKU "${sku}".`, 404);
  }

  let locationId = dto.locationId?.trim();
  if (!locationId) {
    const suggestions = await suggestSourceLocationBySku(sku, dto.quantity);
    if (suggestions.length === 0) {
      throw new AppError(
        `No hay ubicaciones con stock suficiente para SKU "${sku}" (cantidad solicitada: ${dto.quantity}).`,
        400
      );
    }
    locationId = suggestions[0].location.id;
  }

  const location = await prisma.location.findUnique({ where: { id: locationId } });

  if (!location) {
    throw new AppError(
      `No se encontró una ubicación con ID "${locationId}".`,
      404
    );
  }

  // === 1. VERIFICACIÓN DE HORARIO DE DESPACHO ===
  const now = new Date();
  const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

  const parseTime = (timeStr: string) => {
    const parts = timeStr.split(':');
    return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  };

  const startMinutes = parseTime(location.dispatchStart);
  const endMinutes = parseTime(location.dispatchEnd);

  if (currentTotalMinutes < startMinutes || currentTotalMinutes > endMinutes) {
    throw new AppError(
      `No se puede reservar: La sede "${location.name}" fuera de horario (${location.dispatchStart}-${location.dispatchEnd}).`,
      400
    );
  }

  // === 2. VERIFICACIÓN DE LÍMITE DE DESPACHO DIARIO ===
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const todayReservations = await prisma.reservation.aggregate({
    _sum: { quantity: true },
    where: {
      locationId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: { notIn: [ReservationStatus.EXPIRED, ReservationStatus.RELEASED] },
    },
  });

  const currentDailyTotal = todayReservations._sum.quantity || 0;

  if (currentDailyTotal + dto.quantity > location.maxDailyDispatch) {
    throw new AppError(
      `No se puede reservar: La ubicación superaría su límite de despacho diario (${currentDailyTotal}/${location.maxDailyDispatch} artículos reservados hoy).`,
      400
    );
  }

  // === 3. VERIFICACIÓN DE STOCK Y CREACIÓN ATÓMICA (transacción Serializable) ===
  // Evita race condition TOCTOU: la lectura de disponibilidad y la escritura de la
  // reserva ocurren como una unidad indivisible. Con isolationLevel Serializable,
  // dos transacciones concurrentes sobre el mismo stock no pueden ambas aprobar
  // la verificación de disponibilidad simultáneamente.
  const reservation = await prisma.$transaction(async (tx) => {
    const stock = await tx.stock.findUnique({
      where: {
        productId_locationId: { productId: product.id, locationId },
      },
    });

    const reservedAgg = await tx.reservation.aggregate({
      where: { sku, locationId, status: ReservationStatus.ACTIVE },
      _sum: { quantity: true },
    });

    const physicalQty = stock?.quantity ?? 0;
    const reserved = reservedAgg._sum.quantity ?? 0;
    const stockDisponible = physicalQty - reserved;

    if (dto.quantity > stockDisponible) {
      throw new AppError(
        `Stock disponible insuficiente. Disponible: ${stockDisponible}, solicitado: ${dto.quantity}.`,
        400
      );
    }

    const expiresAt = dto.expiresAt
      ? new Date(dto.expiresAt)
      : new Date(Date.now() + config.reservationTtlMinutes * 60 * 1000);

    return tx.reservation.create({
      data: {
        orderId: dto.orderId,
        sku,
        locationId,
        quantity: dto.quantity,
        expiresAt,
        status: ReservationStatus.ACTIVE,
      },
      include: {
        location: { select: { id: true, name: true, type: true } },
      },
    });
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });

  const availability = await getStockDisponible(sku, locationId);

  void eventService.emitStockReserved({
    reservationId: reservation.reservationId,
    sku,
    locationId,
    quantity: dto.quantity,
    orderId: dto.orderId,
    createdAt: (reservation.createdAt ?? new Date()).toISOString(),
    expiresAt: (reservation.expiresAt ?? new Date()).toISOString(),
  });

  return { reservation, ...availability };
};

/**
 * Expira reservas ACTIVE cuyo expiresAt ya pasó (TTL Grupo 3).
 * Libera stock disponible sin tocar quantity físico.
 * @returns Cantidad de reservas expiradas
 */
export const expireStaleReservations = async (): Promise<number> => {
  const now = new Date();

  const stale = await prisma.reservation.findMany({
    where: {
      status: ReservationStatus.ACTIVE,
      expiresAt: { lte: now },
    },
  });

  if (stale.length === 0) {
    return 0;
  }

  await prisma.reservation.updateMany({
    where: {
      reservationId: { in: stale.map((r) => r.reservationId) },
    },
    data: {
      status: ReservationStatus.EXPIRED,
      releasedAt: now,
    },
  });

  for (const r of stale) {
    void eventService.emitStockReleased({
      reservationId: r.reservationId,
      sku: r.sku,
      locationId: r.locationId,
      quantity: r.quantity,
      reason: "EXPIRED",
      orderId: r.orderId ?? undefined,
    });
  }

  return stale.length;
};

/**
 * Lista reservas con filtro opcional por estado.
 */
export const getAllReservations = async (status?: ReservationStatus) => {
  return prisma.reservation.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      location: { select: { id: true, name: true, type: true } },
    },
  });
};

/**
 * SCRUM-20 / SCRUM-57–60: cancelación + liberación en un solo paso.
 * ACTIVE → RELEASED (restaura stock disponible sin tocar quantity físico).
 */
export const cancelAndReleaseReservation = async (
  dto: ReleaseReservationDto
) => {
  const reservation = await prisma.reservation.findUnique({
    where: { reservationId: dto.reservationId },
    include: {
      location: { select: { id: true, name: true } },
    },
  });

  if (!reservation) {
    throw new AppError(
      `No se encontró una reserva con ID ${dto.reservationId}.`,
      404
    );
  }

  if (reservation.status === ReservationStatus.RELEASED) {
    const availability = await getStockDisponible(
      reservation.sku,
      reservation.locationId
    );
    return { reservation, ...availability, alreadyReleased: true };
  }

  if (reservation.status === ReservationStatus.SOLD) {
    throw new AppError(
      "No se puede liberar una reserva ya vendida (entrega confirmada).",
      400
    );
  }

  if (reservation.status !== ReservationStatus.ACTIVE) {
    throw new AppError(
      `La reserva no puede liberarse en estado "${reservation.status}".`,
      400
    );
  }

  const updated = await prisma.reservation.update({
    where: { reservationId: dto.reservationId },
    data: {
      status: ReservationStatus.RELEASED,
      releasedAt: new Date(),
    },
    include: {
      location: { select: { id: true, name: true } },
    },
  });

  const availability = await getStockDisponible(
    updated.sku,
    updated.locationId
  );

  void eventService.emitStockReleased({
    reservationId: updated.reservationId,
    sku: updated.sku,
    locationId: updated.locationId,
    quantity: updated.quantity,
    reason: "RELEASED",
    orderId: updated.orderId ?? undefined,
  });

  return { reservation: updated, ...availability, alreadyReleased: false };
};

/**
 * SCRUM-33: Proyecto 2 confirma entrega → SOLD + movimiento OUT + descuento físico.
 */
export const confirmDelivery = async (
  reservationId: number,
  dto?: ConfirmDeliveryDto
) => {
  const reservation = await prisma.reservation.findUnique({
    where: { reservationId },
    include: {
      location: { select: { id: true, name: true, type: true, city: true } },
    },
  });

  if (!reservation) {
    throw new AppError(
      `No se encontró una reserva con ID ${reservationId}.`,
      404
    );
  }

  if (reservation.status === ReservationStatus.SOLD) {
    const movement = await prisma.movement.findFirst({
      where: { reservationId },
      orderBy: { createdAt: "desc" },
    });
    return { reservation, movement, alreadySold: true };
  }

  if (reservation.status !== ReservationStatus.ACTIVE) {
    throw new AppError(
      `Solo se puede confirmar entrega de reservas ACTIVE. Estado actual: "${reservation.status}".`,
      400
    );
  }

  const product = await prisma.product.findUnique({
    where: { sku: reservation.sku },
  });

  if (!product) {
    throw new AppError(
      `No se encontró el producto con SKU "${reservation.sku}".`,
      404
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const existingStock = await tx.stock.findUnique({
      where: {
        productId_locationId: {
          productId: product.id,
          locationId: reservation.locationId,
        },
      },
    });

    const currentQuantity = existingStock?.quantity ?? 0;

    if (currentQuantity < reservation.quantity) {
      throw new AppError(
        `Stock físico insuficiente. Actual: ${currentQuantity}, requerido: ${reservation.quantity}.`,
        400
      );
    }

    const newQuantity = currentQuantity - reservation.quantity;

    const updatedStock = await tx.stock.upsert({
      where: {
        productId_locationId: {
          productId: product.id,
          locationId: reservation.locationId,
        },
      },
      create: {
        productId: product.id,
        locationId: reservation.locationId,
        quantity: newQuantity,
      },
      update: {
        quantity: newQuantity,
        reserved: { decrement: reservation.quantity },
      },
    });

    const soldAt = dto?.deliveredAt ? new Date(dto.deliveredAt) : new Date();

    const movement = await tx.movement.create({
      data: {
        productId: product.id,
        locationId: reservation.locationId,
        type: MovementType.OUT,
        quantity: reservation.quantity,
        reservationId: reservation.reservationId,
        note:
          dto?.note ??
          `Venta confirmada — Pedido #${reservation.orderId}, Reserva #${reservation.reservationId}`,
      },
    });

    const updatedReservation = await tx.reservation.update({
      where: { reservationId },
      data: {
        status: ReservationStatus.SOLD,
        soldAt,
      },
      include: {
        location: { select: { id: true, name: true, type: true, city: true } },
      },
    });

    return { reservation: updatedReservation, movement, updatedStock, newQuantity };
  });

  let alert: string | undefined;

  if (result.newQuantity <= product.minStock) {
    alert =
      `⚠️ STOCK CRÍTICO: "${product.name}" (SKU: ${product.sku}) ` +
      `en "${reservation.location.name}" tiene solo ${result.newQuantity} unidades.`;

    console.warn(`\n⚠️  ALERTA DE STOCK CRÍTICO (venta confirmada)`);
    console.warn(`   Producto:  ${product.name} (${product.sku})`);
    console.warn(`   Ubicación: ${reservation.location.name}`);
    console.warn(`   Stock:     ${result.newQuantity} unidades\n`);

    void eventService.emitCriticalThreshold({
      alertId: result.movement.id,
      sku: product.sku,
      locationId: reservation.locationId,
      currentStock: result.newQuantity,
      minStock: product.minStock,
      thresholdLimite: product.minStock,
      productName: product.name,
      locationName: result.reservation.location.name,
      locationType: result.reservation.location.type,
      city: result.reservation.location.city ?? undefined,
    });
    notifyIncident({
      alertType: result.newQuantity === 0 ? "stock_out_error" : "critical_threshold_reached",
      sku: product.sku,
      locationId: reservation.locationId,
      locationName: result.reservation.location.name,
      currentStock: result.newQuantity,
      minStock: product.minStock,
      productName: product.name,
    });
  }

  const availability = await getStockDisponible(
    reservation.sku,
    reservation.locationId
  );

  void eventService.emitStockMovement({
    eventType: "stock_dispatched",
    sku: product.sku,
    locationId: reservation.locationId,
    quantity: reservation.quantity,
    unitPrice: product.price ?? undefined,
    category: product.category ?? undefined,
    unit: product.unit ?? undefined,
    productName: product.name,
    locationName: reservation.location.name,
    movementId: result.movement.id,
    // order_id requerido por Grupo 9 para desbloquear reserved_stock (prioridad 2)
    orderId: reservation.orderId ?? undefined,
  });

  return {
    reservation: result.reservation,
    movement: result.movement,
    updatedStock: result.updatedStock,
    ...availability,
    alert,
    alreadySold: false,
  };
};

/**
 * Procesa el evento "Pedido Pagado" proveniente de un sistema externo.
 * SCRUM-31: Confirma la entrega de la reserva (ACTIVE → SOLD + OUT movement)
 * y opcionalmente transiciona la orden a READY_FOR_DISPATCH.
 *
 * @param reservationId ID de la reserva a confirmar
 * @param orderId       ID de la orden (opcional) — se transiciona a READY_FOR_DISPATCH
 */
export const processPaymentConfirmed = async (
  reservationId: number,
  orderId?: string
): Promise<{
  deliveryResult: Awaited<ReturnType<typeof confirmDelivery>>;
  orderTransition?: { id: string; status: string };
}> => {
  const deliveryResult = await confirmDelivery(reservationId);

  let orderTransition: { id: string; status: string } | undefined;

  if (orderId) {
    const updated = await transitionOrder(orderId, "READY_FOR_DISPATCH");
    orderTransition = { id: updated.id, status: updated.status };
  }

  return { deliveryResult, orderTransition };
};
