import prismaMock from "../__mocks__/prismaClient";
import * as reservationService from "../../services/reservation.service";
import * as orderService from "../../services/order.service";
import { AppError } from "../../utils/AppError";

jest.mock("../../services/order.service");
jest.mock("../../services/stock.service");
jest.mock("../../services/event.service");

import * as stockService from "../../services/stock.service";
import * as eventService from "../../services/event.service";

const mockedEmitStockReleased = eventService.emitStockReleased as jest.MockedFunction<typeof eventService.emitStockReleased>;

const mockedSuggestBySku = stockService.suggestSourceLocationBySku as jest.MockedFunction<
  typeof stockService.suggestSourceLocationBySku
>;

const mockProduct = { id: "prod-1", name: "Prod Test", sku: "SKU-001", minStock: 2 };

// Ubicación abierta 24 h para no bloquear por horario en la mayoría de tests
const makeLocation = (overrides: Record<string, unknown> = {}) => ({
  id: "loc-1",
  name: "Bodega A",
  type: "WAREHOUSE",
  priority: 1,
  maxDailyDispatch: 100,
  dispatchStart: "00:00",
  dispatchEnd: "23:59",
  ...overrides,
});

const makeReservation = (status = "ACTIVE") => ({
  reservationId: 1,
  sku: "SKU-001",
  locationId: "loc-1",
  quantity: 5,
  orderId: "550e8400-e29b-41d4-a716-446655440000",
  status,
  expiresAt: null,
  createdAt: new Date(),
  soldAt: null,
  releasedAt: null,
  location: { id: "loc-1", name: "Bodega A" },
});

const makeStock = (qty: number) => ({
  id: "stock-1",
  productId: "prod-1",
  locationId: "loc-1",
  quantity: qty,
  reserved: 0,
});

// Configura los mocks que getStockDisponible necesita después de ciertas operaciones
const setupGetStockDisponibleMocks = (qty: number, reservedQty = 0) => {
  prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
  prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(qty) as any);
  (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
    _sum: { quantity: reservedQty },
  });
};

// ── getActiveReservedQuantity ──────────────────────────────────────

describe("reservationService.getActiveReservedQuantity", () => {
  it("retorna 0 cuando _sum.quantity es null", async () => {
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: null },
    });
    const result = await reservationService.getActiveReservedQuantity("SKU-001", "loc-1");
    expect(result).toBe(0);
  });

  it("retorna la suma cuando hay reservas activas", async () => {
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 15 },
    });
    const result = await reservationService.getActiveReservedQuantity("SKU-001", "loc-1");
    expect(result).toBe(15);
  });
});

// ── getStockDisponible ──────────────────────────────────────────

describe("reservationService.getStockDisponible", () => {
  it("retorna zeros si el producto no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    const result = await reservationService.getStockDisponible("SKU-NOPE", "loc-1");
    expect(result).toEqual({ quantity: 0, reserved: 0, stockDisponible: 0 });
  });

  it("retorna disponibilidad correcta cuando existe producto y stock", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(50) as any);
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 10 },
    });
    const result = await reservationService.getStockDisponible("SKU-001", "loc-1");
    expect(result.quantity).toBe(50);
    expect(result.reserved).toBe(10);
    expect(result.stockDisponible).toBe(40);
  });
});

// ── getAllReservations ──────────────────────────────────────────

describe("reservationService.getAllReservations", () => {
  it("retorna todas las reservas sin filtro de estado", async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([makeReservation()] as any);
    const result = await reservationService.getAllReservations();
    expect(result).toHaveLength(1);
    expect(prismaMock.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: undefined })
    );
  });

  it("filtra por estado cuando se proporciona", async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([] as any);
    await reservationService.getAllReservations("ACTIVE" as any);
    expect(prismaMock.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "ACTIVE" } })
    );
  });
});

// ── cancelAndReleaseReservation ──────────────────────────────────────

describe("reservationService.cancelAndReleaseReservation", () => {
  it("lanza AppError 404 si la reserva no existe", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(null);
    await expect(
      reservationService.cancelAndReleaseReservation({ reservationId: 999 })
    ).rejects.toThrow(AppError);
  });

  it("retorna alreadyReleased: true si ya está RELEASED", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("RELEASED") as any);
    setupGetStockDisponibleMocks(50);
    const result = await reservationService.cancelAndReleaseReservation({ reservationId: 1 });
    expect(result.alreadyReleased).toBe(true);
  });

  it("lanza AppError 400 si la reserva está en estado SOLD", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("SOLD") as any);
    await expect(
      reservationService.cancelAndReleaseReservation({ reservationId: 1 })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si la reserva está en estado no libereable (EXPIRED)", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("EXPIRED") as any);
    await expect(
      reservationService.cancelAndReleaseReservation({ reservationId: 1 })
    ).rejects.toThrow(AppError);
  });

  it("libera correctamente una reserva ACTIVE", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("ACTIVE") as any);
    prismaMock.reservation.update.mockResolvedValueOnce(makeReservation("RELEASED") as any);
    setupGetStockDisponibleMocks(50);
    const result = await reservationService.cancelAndReleaseReservation({ reservationId: 1 });
    expect(result.alreadyReleased).toBe(false);
    expect(prismaMock.reservation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RELEASED" }),
      })
    );
  });

  it("emite stock_dispatched con orderId al liberar reserva ACTIVE (integración Grupo 9)", async () => {
    mockedEmitStockReleased.mockResolvedValueOnce(undefined);
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("ACTIVE") as any);
    prismaMock.reservation.update.mockResolvedValueOnce(makeReservation("RELEASED") as any);
    setupGetStockDisponibleMocks(50);

    await reservationService.cancelAndReleaseReservation({ reservationId: 1 });

    expect(mockedEmitStockReleased).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 1,
        reason: "RELEASED",
        orderId: "550e8400-e29b-41d4-a716-446655440000",
      })
    );
  });
});

// ── createReservation ──────────────────────────────────────────

describe("reservationService.createReservation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // 12:00 UTC — dentro del horario "00:00"–"23:59" de la ubicación estándar
    jest.setSystemTime(new Date("2024-01-01T12:00:00.000Z"));
  });
  afterEach(() => jest.useRealTimers());

  const baseDto = {
    orderId: "550e8400-e29b-41d4-a716-446655440000",
    sku: "SKU-001",
    locationId: "loc-1",
    quantity: 5,
  };

  it("lanza AppError 400 si quantity <= 0", async () => {
    await expect(
      reservationService.createReservation({ ...baseDto, quantity: 0 })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 404 si el producto (SKU) no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    prismaMock.location.findUnique.mockResolvedValueOnce(makeLocation() as any);
    await expect(reservationService.createReservation(baseDto)).rejects.toThrow(AppError);
  });

  it("lanza AppError 404 si la ubicación no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(null);
    await expect(reservationService.createReservation(baseDto)).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si la ubicación está fuera del horario de despacho", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    // Ventana cerrada: 22:00–23:59. Con fake time en 12:00 UTC, getHours()=12 → fuera del rango
    prismaMock.location.findUnique.mockResolvedValueOnce(
      makeLocation({ dispatchStart: "22:00", dispatchEnd: "23:59" }) as any
    );
    await expect(reservationService.createReservation(baseDto)).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si se supera el límite de despacho diario", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(
      makeLocation({ maxDailyDispatch: 3 }) as any
    );
    // Ya hay 2 reservas hoy, pedir 5 más supera el límite de 3
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 2 },
    });
    await expect(reservationService.createReservation(baseDto)).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si el stock disponible es insuficiente (dentro de transacción)", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(makeLocation() as any);
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 0 },
    }); // daily check ok
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(2) as any); // solo 2 disponibles
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 0 },
    }); // reserved inside tx
    // baseDto.quantity = 5 > stockDisponible = 2 → AppError
    await expect(reservationService.createReservation(baseDto)).rejects.toThrow(AppError);
  });

  it("crea reserva exitosamente sin expiresAt personalizado (TTL 30 min)", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(makeLocation() as any);
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 0 },
    }); // daily check
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(100) as any);
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 0 },
    }); // inside tx
    const created = makeReservation("ACTIVE");
    prismaMock.reservation.create.mockResolvedValueOnce({ ...created, location: makeLocation() } as any);
    setupGetStockDisponibleMocks(100, 5);

    const result = await reservationService.createReservation(baseDto);
    expect(result.reservation.status).toBe("ACTIVE");
    expect(prismaMock.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          expiresAt: new Date("2024-01-01T12:30:00.000Z"),
        }),
      })
    );
  });

  it("crea reserva exitosamente con expiresAt personalizado", async () => {
    const dto = { ...baseDto, expiresAt: "2099-12-31T23:59:59.000Z" };
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(makeLocation() as any);
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 0 },
    });
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(100) as any);
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 0 },
    });
    const created = makeReservation("ACTIVE");
    prismaMock.reservation.create.mockResolvedValueOnce({ ...created, location: makeLocation() } as any);
    setupGetStockDisponibleMocks(100, 5);

    const result = await reservationService.createReservation(dto);
    expect(result.reservation.status).toBe("ACTIVE");
    expect(prismaMock.reservation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ expiresAt: new Date("2099-12-31T23:59:59.000Z") }),
      })
    );
  });

  it("elige ubicación automáticamente cuando no se envía locationId", async () => {
    const dto = {
      orderId: "550e8400-e29b-41d4-a716-446655440000",
      sku: "sku-001",
      quantity: 5,
    };

    mockedSuggestBySku.mockResolvedValueOnce([
      {
        location: { id: "loc-1", name: "Bodega A", type: "bodega", priority: 1 },
        quantity: 100,
        reserved: 0,
        stockDisponible: 100,
        rank: 1,
      },
    ]);

    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(makeLocation() as any);
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 0 },
    });
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(100) as any);
    (prismaMock.reservation.aggregate as jest.MockedFunction<any>).mockResolvedValueOnce({
      _sum: { quantity: 0 },
    });
    const created = makeReservation("ACTIVE");
    prismaMock.reservation.create.mockResolvedValueOnce({ ...created, location: makeLocation() } as any);
    setupGetStockDisponibleMocks(100, 5);

    await reservationService.createReservation(dto);

    expect(mockedSuggestBySku).toHaveBeenCalledWith("SKU-001", 5);
    expect(prismaMock.reservation.create).toHaveBeenCalled();
  });
});

// ── expireStaleReservations ──────────────────────────────────────

describe("reservationService.expireStaleReservations", () => {
  it("retorna 0 si no hay reservas vencidas", async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([]);
    const count = await reservationService.expireStaleReservations();
    expect(count).toBe(0);
    expect(prismaMock.reservation.updateMany).not.toHaveBeenCalled();
  });

  it("marca reservas vencidas como EXPIRED", async () => {
    prismaMock.reservation.findMany.mockResolvedValueOnce([
      { reservationId: 1 },
      { reservationId: 2 },
    ] as any);
    prismaMock.reservation.updateMany.mockResolvedValueOnce({ count: 2 } as any);

    const count = await reservationService.expireStaleReservations();
    expect(count).toBe(2);
    expect(prismaMock.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reservationId: { in: [1, 2] } },
        data: expect.objectContaining({ status: "EXPIRED" }),
      })
    );
  });

  it("emite stock_dispatched con orderId por cada reserva expirada (integración Grupo 9)", async () => {
    mockedEmitStockReleased.mockResolvedValue(undefined);
    prismaMock.reservation.findMany.mockResolvedValueOnce([
      {
        reservationId: 10,
        sku: "SKU-001",
        locationId: "loc-1",
        quantity: 3,
        orderId: "550e8400-e29b-41d4-a716-446655440000",
      },
      {
        reservationId: 11,
        sku: "SKU-002",
        locationId: "loc-2",
        quantity: 5,
        orderId: null,
      },
    ] as any);
    prismaMock.reservation.updateMany.mockResolvedValueOnce({ count: 2 } as any);

    await reservationService.expireStaleReservations();

    // Primera reserva: con orderId
    expect(mockedEmitStockReleased).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 10,
        reason: "EXPIRED",
        orderId: "550e8400-e29b-41d4-a716-446655440000",
      })
    );
    // Segunda reserva: orderId null → undefined
    expect(mockedEmitStockReleased).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 11,
        reason: "EXPIRED",
        orderId: undefined,
      })
    );
  });
});

// ── confirmDelivery ──────────────────────────────────────────

describe("reservationService.confirmDelivery", () => {
  it("retorna alreadySold: true si la reserva ya está SOLD", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("SOLD") as any);
    prismaMock.movement.findFirst.mockResolvedValueOnce({ id: "mov-1" } as any);
    const result = await reservationService.confirmDelivery(1);
    expect(result.alreadySold).toBe(true);
  });

  it("lanza AppError 400 si la reserva no está en ACTIVE (ej. EXPIRED)", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("EXPIRED") as any);
    await expect(reservationService.confirmDelivery(1)).rejects.toThrow(AppError);
  });

  it("lanza AppError 404 si el producto del SKU no existe", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("ACTIVE") as any);
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    await expect(reservationService.confirmDelivery(1)).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si el stock físico es insuficiente (dentro de transacción)", async () => {
    prismaMock.reservation.findUnique.mockResolvedValueOnce(makeReservation("ACTIVE") as any);
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    // reservation.quantity = 5, pero stock físico = 2
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(2) as any);
    await expect(reservationService.confirmDelivery(1)).rejects.toThrow(AppError);
  });

  it("dispara alerta de stock crítico cuando newQuantity <= umbral (5)", async () => {
    const reservation = makeReservation("ACTIVE");
    prismaMock.reservation.findUnique.mockResolvedValueOnce(reservation as any);
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    // stock físico = 5, reserva = 5 → newQuantity = 0 ≤ criticalStockThreshold(5)
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(5) as any);
    prismaMock.stock.upsert.mockResolvedValueOnce(makeStock(0) as any);
    prismaMock.movement.create.mockResolvedValueOnce({ id: "mov-1" } as any);
    prismaMock.reservation.update.mockResolvedValueOnce({
      ...reservation, status: "SOLD", soldAt: new Date(),
    } as any);
    setupGetStockDisponibleMocks(0);

    const result = await reservationService.confirmDelivery(1) as any;
    expect(result.alert).toBeDefined();
    expect(result.alert).toContain("STOCK CRÍTICO");
  });

  it("no incluye alerta cuando el stock resultante está sobre el umbral", async () => {
    const reservation = makeReservation("ACTIVE");
    prismaMock.reservation.findUnique.mockResolvedValueOnce(reservation as any);
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    // stock físico = 50, reserva = 5 → newQuantity = 45 > 5
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(50) as any);
    prismaMock.stock.upsert.mockResolvedValueOnce(makeStock(45) as any);
    prismaMock.movement.create.mockResolvedValueOnce({ id: "mov-1" } as any);
    prismaMock.reservation.update.mockResolvedValueOnce({
      ...reservation, status: "SOLD", soldAt: new Date(),
    } as any);
    setupGetStockDisponibleMocks(45);

    const result = await reservationService.confirmDelivery(1) as any;
    expect(result.alert).toBeUndefined();
    expect(result.alreadySold).toBe(false);
  });

  it("usa deliveredAt y note del DTO cuando se proporcionan", async () => {
    const reservation = makeReservation("ACTIVE");
    prismaMock.reservation.findUnique.mockResolvedValueOnce(reservation as any);
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.stock.findUnique.mockResolvedValueOnce(makeStock(50) as any);
    prismaMock.stock.upsert.mockResolvedValueOnce(makeStock(45) as any);
    prismaMock.movement.create.mockResolvedValueOnce({ id: "mov-1" } as any);
    prismaMock.reservation.update.mockResolvedValueOnce({
      ...reservation, status: "SOLD", soldAt: new Date("2024-06-01"),
    } as any);
    setupGetStockDisponibleMocks(45);

    const dto = { deliveredAt: "2024-06-01T10:00:00.000Z", note: "Entrega confirmada manualmente" };
    await reservationService.confirmDelivery(1, dto);
    expect(prismaMock.movement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ note: "Entrega confirmada manualmente" }),
      })
    );
  });
});
