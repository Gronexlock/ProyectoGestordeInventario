// ============================================================
// Servicio: Cola outbox de eventos hacia Analítica (Grupo 9)
// ============================================================

import { EventStatus, Prisma } from "@prisma/client";
import prisma from "../prisma/client";
import { config } from "../config/config";
import { logger } from "../config/logger";
import { NotFoundError } from "../utils/errors";

const BACKOFF_MS = [30_000, 60_000, 300_000, 900_000, 3_600_000];

const buildEnvelope = (eventType: string, payload: Record<string, unknown>) => ({
  source: "inventory",
  event_type: eventType,
  payload,
});

export const toUUIDv4 = (id: number): string => {
  const hex = id.toString(16).padStart(12, "0");
  return `00000000-0000-4000-8000-${hex}`;
};

export const enqueueEvent = async (
  eventType: string,
  payload: Record<string, unknown>,
  idempotencyKey?: string
): Promise<void> => {
  try {
    await prisma.outboundEvent.create({
      data: {
        eventType,
        payload: payload as Prisma.InputJsonValue,
        idempotencyKey,
        maxAttempts: config.eventMaxAttempts,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      logger.debug("Evento duplicado ignorado (idempotencyKey)", { idempotencyKey });
      return;
    }
    logger.error("Error al encolar evento", { eventType, error });
  }
};

export const listOutboundEvents = async (status?: EventStatus) =>
  prisma.outboundEvent.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
  });

export const retryEvent = async (id: string) => {
  const event = await prisma.outboundEvent.findUnique({ where: { id } });
  if (!event) throw new NotFoundError("Evento outbox", id);

  return prisma.outboundEvent.update({
    where: { id },
    data: {
      status: EventStatus.PENDING,
      nextRetryAt: new Date(),
      lastError: null,
      attempts: 0,
    },
  });
};

const postEvent = async (eventType: string, payload: Record<string, unknown>) => {
  const url = config.analyticsEventsUrl;
  if (!url) {
    throw new Error("ANALYTICS_EVENTS_URL no configurada.");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (config.analyticsApiKey) {
    headers["X-Api-Key"] = config.analyticsApiKey;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(buildEnvelope(eventType, payload)),
    signal: AbortSignal.timeout(config.eventRequestTimeoutMs),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`);
  }
};

export const processPendingEvents = async (): Promise<number> => {
  if (!config.analyticsEventsUrl) {
    return 0;
  }

  const now = new Date();
  const batch = await prisma.outboundEvent.findMany({
    where: {
      status: { in: [EventStatus.PENDING, EventStatus.FAILED] },
      nextRetryAt: { lte: now },
      attempts: { lt: config.eventMaxAttempts },
    },
    orderBy: { nextRetryAt: "asc" },
    take: 50,
  });

  let processed = 0;

  for (const event of batch) {
    try {
      await postEvent(event.eventType, event.payload as Record<string, unknown>);
      await prisma.outboundEvent.update({
        where: { id: event.id },
        data: {
          status: EventStatus.SENT,
          sentAt: new Date(),
          lastError: null,
        },
      });
      processed++;
    } catch (error) {
      const attempts = event.attempts + 1;
      const isDead = attempts >= event.maxAttempts;
      const backoff = BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)];

      await prisma.outboundEvent.update({
        where: { id: event.id },
        data: {
          attempts,
          status: isDead ? EventStatus.DEAD : EventStatus.FAILED,
          lastError: error instanceof Error ? error.message : String(error),
          nextRetryAt: new Date(Date.now() + backoff),
        },
      });
    }
  }

  return processed;
};

export const emitStockMovement = async (params: {
  eventType: "stock_received" | "stock_dispatched" | "stock_adjusted" | "stock_transfer_initiated";
  sku: string;
  locationId: string;
  quantity: number;
  /** Desbloquea total_stock_value en Grupo 9 (prioridad 1) */
  unitPrice?: number;
  /** Desbloquea catálogo de productos en Grupo 9 (prioridad 4) */
  category?: string;
  unit?: string;
  productName?: string;
  locationName?: string;
  locationType?: string;
  movementId?: string;
  /** Desbloquea reserved_stock en Grupo 9 (prioridad 2) — requerido en stock_dispatched */
  orderId?: string;
  destinationId?: string;
  receivedAt?: string;
}) => {
  const payload: Record<string, unknown> = {
    sku_id: params.sku,
    location_id: params.locationId,
  };

  if (params.eventType === "stock_received") {
    payload.quantity_received = params.quantity;
    payload.received_at = params.receivedAt ?? new Date().toISOString();
  } else {
    payload.quantity = params.quantity;
  }

  if (params.eventType === "stock_transfer_initiated" && params.destinationId !== undefined) {
    payload.destination_id = params.destinationId;
  }

  if (params.unitPrice !== undefined) payload.unit_price = params.unitPrice;
  if (params.category !== undefined) payload.category = params.category;
  if (params.unit !== undefined) payload.unit = params.unit;
  if (params.productName !== undefined) payload.product_name = params.productName;
  if (params.locationName !== undefined) payload.location_name = params.locationName;
  if (params.locationType !== undefined) payload.location_type = params.locationType;
  if (params.movementId !== undefined) payload.movement_id = params.movementId;
  if (params.orderId !== undefined) payload.order_id = params.orderId;

  await enqueueEvent(
    params.eventType,
    payload,
    params.movementId ? `${params.eventType}:${params.movementId}` : undefined
  );
};

export const emitStockReserved = async (params: {
  reservationId: number;
  sku: string;
  locationId: string;
  quantity: number;
  orderId: string;
  createdAt?: string;
  expiresAt?: string;
}) => {
  await enqueueEvent(
    "stock_reserved",
    {
      reservation_id: toUUIDv4(params.reservationId),
      order_id: params.orderId,
      sku_id: params.sku,
      location_id: params.locationId,
      quantity: params.quantity,
      created_at: params.createdAt ?? new Date().toISOString(),
      expires_at: params.expiresAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
    `stock_reserved:${params.reservationId}`
  );
};

export const emitStockReleased = async (params: {
  reservationId: number;
  sku: string;
  locationId: string;
  quantity: number;
  reason: "RELEASED" | "EXPIRED";
  /** order_id requerido por Grupo 9 para restar de reserved_stock */
  orderId?: string;
}) => {
  // El Grupo 9 no acepta "stock_released" como event_type.
  // Se usa "stock_dispatched" con el mismo order_id de la reserva,
  // lo que permite al Grupo 9 restar del reserved_stock correctamente.
  await enqueueEvent(
    "stock_dispatched",
    {
      sku_id: params.sku,
      location_id: params.locationId,
      quantity: params.quantity,
      ...(params.orderId !== undefined && { order_id: params.orderId }),
    },
    `stock_dispatched:release:${params.reservationId}:${params.reason}`
  );
};

export const emitCriticalThreshold = async (params: {
  alertId: string;
  sku: string;
  locationId: string;
  currentStock: number;
  minStock: number;
  productName?: string;
  locationName?: string;
  locationType?: string;
  /** Umbral crítico en unidades — desbloquea ubicaciones en dashboard Grupo 9 (prioridad 3) */
  thresholdLimite?: number;
  /** Ciudad de la ubicación — desbloquea mapa geográfico en Grupo 9 (prioridad 3) */
  city?: string;
}) => {
  const eventType = params.currentStock === 0 ? "stock_out_error" : "critical_threshold_reached";
  await enqueueEvent(
    eventType,
    {
      sku_id: params.sku,
      location_id: params.locationId,
      current_stock: params.currentStock,
      threshold_limite: params.thresholdLimite ?? params.minStock,
      ...(params.productName !== undefined && { product_name: params.productName }),
      ...(params.locationName !== undefined && { location_name: params.locationName }),
      ...(params.locationType !== undefined && { location_type: params.locationType }),
      ...(params.city !== undefined && { city: params.city }),
      alert_id: params.alertId,
    },
    `${eventType}:${params.alertId}`
  );
};
