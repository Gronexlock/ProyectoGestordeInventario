const mockConfig = {
  analyticsEventsUrl: "",
  analyticsApiKey: "",
  eventMaxAttempts: 5,
  eventRequestTimeoutMs: 10000,
};

jest.mock("../../config/config", () => ({ config: mockConfig }));

import { Prisma, EventStatus } from "@prisma/client";
import prismaMock from "../__mocks__/prismaClient";
import * as eventService from "../../services/event.service";
import { NotFoundError } from "../../utils/errors";

describe("eventService.enqueueEvent", () => {
  beforeEach(() => {
    mockConfig.analyticsEventsUrl = "";
  });

  it("crea un evento en outbox", async () => {
    prismaMock.outboundEvent.create.mockResolvedValueOnce({ id: "ev-1" } as any);
    await eventService.enqueueEvent("stock_received", { sku_id: "SKU-1", quantity: 5 });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalled();
  });

  it("ignora duplicados por idempotencyKey (P2002)", async () => {
    const p2002 = new Prisma.PrismaClientKnownRequestError("Unique constraint", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    prismaMock.outboundEvent.create.mockRejectedValueOnce(p2002);
    await expect(
      eventService.enqueueEvent("stock_received", { sku_id: "SKU-1" }, "key-1")
    ).resolves.toBeUndefined();
  });

  it("traga errores genéricos sin lanzar", async () => {
    prismaMock.outboundEvent.create.mockRejectedValueOnce(new Error("DB down"));
    await expect(
      eventService.enqueueEvent("stock_received", { sku_id: "SKU-1" })
    ).resolves.toBeUndefined();
  });
});

describe("eventService.emit helpers", () => {
  beforeEach(() => {
    prismaMock.outboundEvent.create.mockResolvedValue({ id: "ev-1" } as any);
  });

  it("emitStockMovement encola con idempotencyKey si hay movementId", async () => {
    await eventService.emitStockMovement({
      eventType: "stock_received",
      sku: "SKU-1",
      locationId: "loc-1",
      quantity: 10,
      movementId: "mov-1",
    });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ idempotencyKey: "stock_received:mov-1" }),
      })
    );
  });

  it("emitStockMovement incluye unit_price, category y unit en el payload (prioridad 1+4)", async () => {
    await eventService.emitStockMovement({
      eventType: "stock_received",
      sku: "SKU-1",
      locationId: "loc-1",
      quantity: 50,
      unitPrice: 12500.00,
      category: "Ferretería",
      unit: "unidad",
      movementId: "mov-2",
    });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            unit_price: 12500.00,
            category: "Ferretería",
            unit: "unidad",
          }),
        }),
      })
    );
  });

  it("emitStockMovement incluye order_id en stock_dispatched (prioridad 2 — reserved_stock)", async () => {
    await eventService.emitStockMovement({
      eventType: "stock_dispatched",
      sku: "SKU-1",
      locationId: "loc-1",
      quantity: 5,
      movementId: "mov-3",
      orderId: "order-uuid-123",
    });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            order_id: "order-uuid-123",
          }),
        }),
      })
    );
  });

  it("emitStockMovement no incluye campos opcionales undefined en el payload", async () => {
    await eventService.emitStockMovement({
      eventType: "stock_received",
      sku: "SKU-1",
      locationId: "loc-1",
      quantity: 10,
    });
    const call = prismaMock.outboundEvent.create.mock.calls[0][0];
    const payload = call.data.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("unit_price");
    expect(payload).not.toHaveProperty("category");
    expect(payload).not.toHaveProperty("order_id");
  });

  it("emitStockReserved encola evento stock_reserved", async () => {
    await eventService.emitStockReserved({
      reservationId: 42,
      sku: "SKU-1",
      locationId: "loc-1",
      quantity: 3,
      orderId: "order-uuid",
    });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "stock_reserved" }) })
    );
  });

  it("emitStockReleased encola evento stock_dispatched (Grupo 9 no acepta stock_released)", async () => {
    await eventService.emitStockReleased({
      reservationId: 7,
      sku: "SKU-1",
      locationId: "loc-1",
      quantity: 2,
      reason: "EXPIRED",
    });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ eventType: "stock_dispatched" }) })
    );
  });

  it("emitStockReleased incluye order_id en el payload cuando se proporciona orderId", async () => {
    await eventService.emitStockReleased({
      reservationId: 8,
      sku: "SKU-1",
      locationId: "loc-1",
      quantity: 3,
      reason: "RELEASED",
      orderId: "550e8400-e29b-41d4-a716-446655440099",
    });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: "stock_dispatched",
          payload: expect.objectContaining({
            order_id: "550e8400-e29b-41d4-a716-446655440099",
          }),
        }),
      })
    );
  });

  it("emitStockReleased NO incluye order_id en el payload si no se proporciona orderId", async () => {
    await eventService.emitStockReleased({
      reservationId: 9,
      sku: "SKU-1",
      locationId: "loc-1",
      quantity: 2,
      reason: "EXPIRED",
    });
    const call = prismaMock.outboundEvent.create.mock.calls[0][0];
    const payload = call.data.payload as Record<string, unknown>;
    expect(payload).not.toHaveProperty("order_id");
  });

  it("emitCriticalThreshold encola evento critical_threshold_reached", async () => {
    await eventService.emitCriticalThreshold({
      alertId: "alert-1",
      sku: "SKU-1",
      locationId: "loc-1",
      currentStock: 2,
      minStock: 10,
    });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventType: "critical_threshold_reached" }),
      })
    );
  });

  it("emitCriticalThreshold incluye threshold_limite y city (prioridad 3 — metadatos ubicación)", async () => {
    await eventService.emitCriticalThreshold({
      alertId: "alert-2",
      sku: "SKU-2",
      locationId: "loc-2",
      currentStock: 3,
      minStock: 20,
      thresholdLimite: 20,
      locationName: "Bodega Norte",
      locationType: "WAREHOUSE",
      city: "Santiago",
    });
    expect(prismaMock.outboundEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            threshold_limite: 20,
            city: "Santiago",
            location_name: "Bodega Norte",
            location_type: "WAREHOUSE",
          }),
        }),
      })
    );
  });

  it("emitCriticalThreshold usa minStock como threshold_limite si no se pasa thresholdLimite", async () => {
    await eventService.emitCriticalThreshold({
      alertId: "alert-3",
      sku: "SKU-3",
      locationId: "loc-3",
      currentStock: 1,
      minStock: 15,
    });
    const call = prismaMock.outboundEvent.create.mock.calls[0][0];
    const payload = call.data.payload as Record<string, unknown>;
    expect(payload.threshold_limite).toBe(15);
  });

  it("toUUIDv4 convierte correctamente un entero a UUID v4 determinista", () => {
    const uuid = eventService.toUUIDv4(42);
    expect(uuid).toBe("00000000-0000-4000-8000-00000000002a");
  });

  it("emitStockMovement usa quantity_received y received_at para stock_received", async () => {
    await eventService.emitStockMovement({
      eventType: "stock_received",
      sku: "SKU-TEST-1",
      locationId: "loc-test-1",
      quantity: 120,
      receivedAt: "2026-06-30T10:00:00Z",
    });
    const call = prismaMock.outboundEvent.create.mock.calls[0][0];
    const payload = call.data.payload as any;
    expect(call.data.eventType).toBe("stock_received");
    expect(payload.quantity_received).toBe(120);
    expect(payload.received_at).toBe("2026-06-30T10:00:00Z");
    expect(payload.quantity).toBeUndefined();
  });

  it("emitStockMovement incluye destination_id para stock_transfer_initiated", async () => {
    await eventService.emitStockMovement({
      eventType: "stock_transfer_initiated",
      sku: "SKU-TEST-1",
      locationId: "loc-test-1",
      destinationId: "loc-dest-1",
      quantity: 50,
    });
    const call = prismaMock.outboundEvent.create.mock.calls[0][0];
    const payload = call.data.payload as any;
    expect(call.data.eventType).toBe("stock_transfer_initiated");
    expect(payload.destination_id).toBe("loc-dest-1");
  });

  it("emitCriticalThreshold usa stock_out_error si currentStock es 0", async () => {
    await eventService.emitCriticalThreshold({
      alertId: "alert-out",
      sku: "SKU-OUT",
      locationId: "loc-out",
      currentStock: 0,
      minStock: 10,
    });
    const call = prismaMock.outboundEvent.create.mock.calls[0][0];
    const payload = call.data.payload as any;
    expect(call.data.eventType).toBe("stock_out_error");
    expect(payload.current_stock).toBe(0);
  });
});

describe("eventService.listOutboundEvents", () => {
  it("lista todos los eventos sin filtro", async () => {
    prismaMock.outboundEvent.findMany.mockResolvedValueOnce([{ id: "ev-1" }] as any);
    const result = await eventService.listOutboundEvents();
    expect(result).toHaveLength(1);
    expect(prismaMock.outboundEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
  });

  it("filtra por status", async () => {
    prismaMock.outboundEvent.findMany.mockResolvedValueOnce([] as any);
    await eventService.listOutboundEvents(EventStatus.FAILED);
    expect(prismaMock.outboundEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: EventStatus.FAILED } })
    );
  });
});

describe("eventService.processPendingEvents", () => {
  beforeEach(() => {
    mockConfig.analyticsEventsUrl = "";
    mockConfig.analyticsApiKey = "test-key";
  });

  it("retorna 0 si no hay URL de analítica configurada", async () => {
    const count = await eventService.processPendingEvents();
    expect(count).toBe(0);
  });

  it("envía eventos pendientes y marca como SENT", async () => {
    mockConfig.analyticsEventsUrl = "http://analytics.test/events";
    const pendingEvent = {
      id: "ev-1",
      eventType: "stock_received",
      payload: { sku_id: "SKU-1" },
      attempts: 0,
      maxAttempts: 5,
    };
    prismaMock.outboundEvent.findMany.mockResolvedValueOnce([pendingEvent] as any);
    prismaMock.outboundEvent.update.mockResolvedValueOnce({} as any);

    global.fetch = jest.fn().mockResolvedValue({ ok: true });

    const count = await eventService.processPendingEvents();
    expect(count).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "http://analytics.test/events",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "X-Api-Key": "test-key" }),
      })
    );
    expect(prismaMock.outboundEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: EventStatus.SENT }),
      })
    );
  });

  it("marca FAILED con backoff si el POST falla", async () => {
    mockConfig.analyticsEventsUrl = "http://analytics.test/events";
    const pendingEvent = {
      id: "ev-2",
      eventType: "stock_dispatched",
      payload: {},
      attempts: 1,
      maxAttempts: 5,
    };
    prismaMock.outboundEvent.findMany.mockResolvedValueOnce([pendingEvent] as any);
    prismaMock.outboundEvent.update.mockResolvedValueOnce({} as any);

    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => "error" });

    const count = await eventService.processPendingEvents();
    expect(count).toBe(0);
    expect(prismaMock.outboundEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: EventStatus.FAILED,
          attempts: 2,
        }),
      })
    );
  });

  it("marca DEAD cuando se agotan los reintentos", async () => {
    mockConfig.analyticsEventsUrl = "http://analytics.test/events";
    const pendingEvent = {
      id: "ev-3",
      eventType: "stock_adjusted",
      payload: {},
      attempts: 4,
      maxAttempts: 5,
    };
    prismaMock.outboundEvent.findMany.mockResolvedValueOnce([pendingEvent] as any);
    prismaMock.outboundEvent.update.mockResolvedValueOnce({} as any);

    global.fetch = jest.fn().mockRejectedValue(new Error("Network error"));

    await eventService.processPendingEvents();
    expect(prismaMock.outboundEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: EventStatus.DEAD, attempts: 5 }),
      })
    );
  });
});

describe("eventService.retryEvent", () => {
  it("reencola evento existente", async () => {
    prismaMock.outboundEvent.findUnique.mockResolvedValueOnce({ id: "ev-1" } as any);
    prismaMock.outboundEvent.update.mockResolvedValueOnce({ id: "ev-1", status: "PENDING" } as any);
    const result = await eventService.retryEvent("ev-1");
    expect(result.status).toBe("PENDING");
  });

  it("lanza NotFoundError si el evento no existe", async () => {
    prismaMock.outboundEvent.findUnique.mockResolvedValueOnce(null);
    await expect(eventService.retryEvent("no-existe")).rejects.toThrow(NotFoundError);
  });
});
