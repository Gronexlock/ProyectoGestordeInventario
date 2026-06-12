import prismaMock from "../__mocks__/prismaClient";
import * as orderService from "../../services/order.service";
import { AppError } from "../../utils/AppError";

const mockProduct = { id: "prod-1", name: "Prod Test", sku: "SKU-001", minStock: 10 };
const mockLocation = {
  id: "loc-1", name: "Bodega A", type: "WAREHOUSE",
  dispatchStart: "08:00", dispatchEnd: "20:00", priority: 1,
};

const makeOrder = (status: string) => ({
  id: "order-1",
  customerName: "Cliente Test",
  status,
  createdAt: new Date(),
  updatedAt: new Date(),
  items: [{ productId: "prod-1", locationId: "loc-1", quantity: 5 }],
});

const makeOrderFull = (status: string) => ({
  ...makeOrder(status),
  items: [{
    productId: "prod-1", locationId: "loc-1", quantity: 5,
    product: mockProduct,
    location: mockLocation,
  }],
});

// ── createOrder ──────────────────────────────────────────────────

describe("orderService.createOrder", () => {
  const dto = {
    customerName: "Cliente",
    items: [{ productId: "prod-1", locationId: "loc-1", quantity: 5 }],
  };

  it("lanza AppError 404 si algún producto no existe", async () => {
    prismaMock.product.findMany.mockResolvedValueOnce([] as any);
    prismaMock.location.findMany.mockResolvedValueOnce([mockLocation] as any);
    await expect(orderService.createOrder(dto)).rejects.toThrow(AppError);
  });

  it("lanza AppError 404 si alguna ubicación no existe", async () => {
    prismaMock.product.findMany.mockResolvedValueOnce([mockProduct] as any);
    prismaMock.location.findMany.mockResolvedValueOnce([] as any);
    await expect(orderService.createOrder(dto)).rejects.toThrow(AppError);
  });

  it("crea el pedido en estado PENDING", async () => {
    prismaMock.product.findMany.mockResolvedValueOnce([mockProduct] as any);
    prismaMock.location.findMany.mockResolvedValueOnce([mockLocation] as any);
    prismaMock.order.create.mockResolvedValueOnce(makeOrderFull("PENDING") as any);
    const result = await orderService.createOrder(dto);
    expect(result.status).toBe("PENDING");
  });
});

// ── getReadyForDispatch ──────────────────────────────────────────

describe("orderService.getReadyForDispatch", () => {
  it("lanza AppError 404 si locationId no existe en BD", async () => {
    prismaMock.location.findUnique.mockResolvedValueOnce(null);
    await expect(orderService.getReadyForDispatch({ locationId: "no-existe" }))
      .rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si dateFrom es posterior a dateTo", async () => {
    await expect(
      orderService.getReadyForDispatch({ dateFrom: "2024-12-31", dateTo: "2024-01-01" })
    ).rejects.toThrow(AppError);
  });

  it("filtra por rango completo de fechas (dateFrom + dateTo)", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([] as any);
    const result = await orderService.getReadyForDispatch({
      dateFrom: "2024-01-01", dateTo: "2024-01-31",
    });
    expect(result).toEqual([]);
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }) }),
      })
    );
  });

  it("filtra solo por dateFrom", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([] as any);
    await orderService.getReadyForDispatch({ dateFrom: "2024-01-01" });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: expect.objectContaining({ gte: expect.any(Date) }) }),
      })
    );
  });

  it("filtra solo por dateTo", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([] as any);
    await orderService.getReadyForDispatch({ dateTo: "2024-01-31" });
    expect(prismaMock.order.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: expect.objectContaining({ lte: expect.any(Date) }) }),
      })
    );
  });

  it("retorna pedidos sin filtros opcionales", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([makeOrderFull("READY_FOR_DISPATCH")] as any);
    const result = await orderService.getReadyForDispatch({});
    expect(result).toHaveLength(1);
  });

  it("filtra por locationId existente", async () => {
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.order.findMany.mockResolvedValueOnce([makeOrderFull("READY_FOR_DISPATCH")] as any);
    const result = await orderService.getReadyForDispatch({ locationId: "loc-1" });
    expect(result).toHaveLength(1);
  });
});

// ── getAllOrders ──────────────────────────────────────────────────

describe("orderService.getAllOrders", () => {
  it("retorna todos los pedidos", async () => {
    prismaMock.order.findMany.mockResolvedValueOnce([makeOrderFull("PENDING")] as any);
    const result = await orderService.getAllOrders();
    expect(result).toHaveLength(1);
  });
});

// ── getOrderById ──────────────────────────────────────────────────

describe("orderService.getOrderById", () => {
  it("lanza AppError 404 si el pedido no existe", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(null);
    await expect(orderService.getOrderById("no-existe")).rejects.toThrow(AppError);
  });

  it("retorna el pedido si existe", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrderFull("PENDING") as any);
    const result = await orderService.getOrderById("order-1");
    expect(result.id).toBe("order-1");
  });
});

// ── transitionOrder ──────────────────────────────────────────────

describe("orderService.transitionOrder", () => {
  it("lanza AppError 404 si el pedido no existe", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(null);
    await expect(orderService.transitionOrder("no-existe", "RESERVED")).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 para transición inválida (PENDING → DELIVERED)", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("PENDING") as any);
    await expect(orderService.transitionOrder("order-1", "DELIVERED")).rejects.toThrow(AppError);
  });

  it('muestra "ninguno" en el mensaje de error para estados terminales (DELIVERED)', async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("DELIVERED") as any);
    await expect(orderService.transitionOrder("order-1", "CANCELLED"))
      .rejects.toThrow(/ninguno/);
  });

  it("PENDING → RESERVED: reserva stock correctamente", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("PENDING") as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 50, reserved: 0 } as any);
    prismaMock.stock.update.mockResolvedValueOnce({} as any);
    prismaMock.order.update.mockResolvedValueOnce({} as any);
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrderFull("RESERVED") as any);

    const result = await orderService.transitionOrder("order-1", "RESERVED");
    expect(result.status).toBe("RESERVED");
    expect(prismaMock.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reserved: { increment: 5 } } })
    );
  });

  it("RESERVED → READY_FOR_DISPATCH: sin cambio de stock", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("RESERVED") as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.order.update.mockResolvedValueOnce({} as any);
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrderFull("READY_FOR_DISPATCH") as any);

    const result = await orderService.transitionOrder("order-1", "READY_FOR_DISPATCH");
    expect(result.status).toBe("READY_FOR_DISPATCH");
    expect(prismaMock.stock.update).not.toHaveBeenCalled();
  });

  it("RESERVED → CANCELLED: libera stock", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("RESERVED") as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.stock.update.mockResolvedValueOnce({} as any);
    prismaMock.order.update.mockResolvedValueOnce({} as any);
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrderFull("CANCELLED") as any);

    const result = await orderService.transitionOrder("order-1", "CANCELLED");
    expect(result.status).toBe("CANCELLED");
    expect(prismaMock.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reserved: { decrement: 5 } } })
    );
  });

  it("READY_FOR_DISPATCH → CANCELLED: libera stock", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("READY_FOR_DISPATCH") as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.stock.update.mockResolvedValueOnce({} as any);
    prismaMock.order.update.mockResolvedValueOnce({} as any);
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrderFull("CANCELLED") as any);

    const result = await orderService.transitionOrder("order-1", "CANCELLED");
    expect(result.status).toBe("CANCELLED");
    expect(prismaMock.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reserved: { decrement: 5 } } })
    );
  });

  it("IN_TRANSIT → DELIVERED: sin cambio de stock", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("IN_TRANSIT") as any);
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
    prismaMock.order.update.mockResolvedValueOnce({} as any);
    prismaMock.order.findUnique.mockResolvedValueOnce(makeOrderFull("DELIVERED") as any);

    const result = await orderService.transitionOrder("order-1", "DELIVERED");
    expect(result.status).toBe("DELIVERED");
    expect(prismaMock.stock.update).not.toHaveBeenCalled();
  });

  describe("READY_FOR_DISPATCH → IN_TRANSIT (fake timers: 15:00 UTC = 12:00 Santiago)", () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date("2024-01-01T15:00:00.000Z"));
    });
    afterEach(() => jest.useRealTimers());

    it("transiciona correctamente cuando hay schedule y ventana horaria válida", async () => {
      prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("READY_FOR_DISPATCH") as any);
      prismaMock.dispatchSchedule.findFirst.mockResolvedValueOnce({ id: "sched-1", status: "SCHEDULED" } as any);
      prismaMock.location.findMany.mockResolvedValueOnce([
        { id: "loc-1", name: "Bodega A", dispatchStart: "08:00", dispatchEnd: "20:00" },
      ] as any);
      prismaMock.$transaction.mockImplementation(async (fn: any) => fn(prismaMock));
      prismaMock.stock.update.mockResolvedValueOnce({} as any);
      prismaMock.movement.create.mockResolvedValueOnce({ id: "mov-1" } as any);
      prismaMock.order.update.mockResolvedValueOnce({} as any);
      prismaMock.order.findUnique.mockResolvedValueOnce(makeOrderFull("IN_TRANSIT") as any);

      const result = await orderService.transitionOrder("order-1", "IN_TRANSIT");
      expect(result.status).toBe("IN_TRANSIT");
      expect(prismaMock.movement.create).toHaveBeenCalled();
    });

    it("lanza AppError si no hay DispatchSchedule válido para hoy", async () => {
      prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("READY_FOR_DISPATCH") as any);
      prismaMock.dispatchSchedule.findFirst.mockResolvedValueOnce(null);
      await expect(orderService.transitionOrder("order-1", "IN_TRANSIT")).rejects.toThrow(AppError);
    });

    it("lanza AppError si la ubicación está fuera del horario de despacho", async () => {
      prismaMock.order.findUnique.mockResolvedValueOnce(makeOrder("READY_FOR_DISPATCH") as any);
      prismaMock.dispatchSchedule.findFirst.mockResolvedValueOnce({ id: "sched-1" } as any);
      prismaMock.location.findMany.mockResolvedValueOnce([
        { id: "loc-1", name: "Bodega A", dispatchStart: "22:00", dispatchEnd: "23:59" },
      ] as any);
      await expect(orderService.transitionOrder("order-1", "IN_TRANSIT")).rejects.toThrow(AppError);
    });
  });
});

// ── validateDispatchSchedule ──────────────────────────────────────

describe("orderService.validateDispatchSchedule", () => {
  it("lanza AppError si no hay DispatchSchedule válido para hoy", async () => {
    prismaMock.dispatchSchedule.findFirst.mockResolvedValueOnce(null);
    await expect(orderService.validateDispatchSchedule("order-1")).rejects.toThrow(AppError);
  });

  it("no lanza si existe un DispatchSchedule válido para hoy", async () => {
    prismaMock.dispatchSchedule.findFirst.mockResolvedValueOnce({ id: "sched-1", status: "SCHEDULED" } as any);
    await expect(orderService.validateDispatchSchedule("order-1")).resolves.toBeUndefined();
  });
});

// ── validateDispatchWindow ──────────────────────────────────────

describe("orderService.validateDispatchWindow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2024-01-01T15:00:00.000Z"));
  });
  afterEach(() => jest.useRealTimers());

  it("no lanza si la hora actual está dentro de la ventana de despacho", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([
      { id: "loc-1", name: "Bodega A", dispatchStart: "08:00", dispatchEnd: "20:00" },
    ] as any);
    await expect(orderService.validateDispatchWindow(["loc-1"])).resolves.toBeUndefined();
  });

  it("lanza AppError si la hora actual está fuera de la ventana", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([
      { id: "loc-1", name: "Bodega A", dispatchStart: "22:00", dispatchEnd: "23:59" },
    ] as any);
    await expect(orderService.validateDispatchWindow(["loc-1"])).rejects.toThrow(AppError);
  });

  it("lanza AppError si el formato de horario es inválido", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([
      { id: "loc-1", name: "Bodega A", dispatchStart: "formato-malo", dispatchEnd: "20:00" },
    ] as any);
    await expect(orderService.validateDispatchWindow(["loc-1"])).rejects.toThrow(AppError);
  });

  it("lanza AppError si la hora tiene rango inválido (horas > 23)", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([
      { id: "loc-1", name: "Bodega A", dispatchStart: "24:00", dispatchEnd: "20:00" },
    ] as any);
    await expect(orderService.validateDispatchWindow(["loc-1"])).rejects.toThrow(AppError);
  });

  it("deduplica locationIds antes de consultar la BD", async () => {
    prismaMock.location.findMany.mockResolvedValueOnce([
      { id: "loc-1", name: "Bodega A", dispatchStart: "08:00", dispatchEnd: "20:00" },
    ] as any);
    await orderService.validateDispatchWindow(["loc-1", "loc-1", "loc-1"]);
    expect(prismaMock.location.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["loc-1"] } } })
    );
  });
});

// ── createDispatchSchedule ──────────────────────────────────────

describe("orderService.createDispatchSchedule", () => {
  it("lanza AppError 404 si el pedido no existe", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(null);
    await expect(
      orderService.createDispatchSchedule("no-existe", { scheduleDate: "2099-01-01" })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si el pedido no está en READY_FOR_DISPATCH", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "PENDING" } as any);
    await expect(
      orderService.createDispatchSchedule("order-1", { scheduleDate: "2099-01-01" })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si la fecha proporcionada es inválida", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "READY_FOR_DISPATCH" } as any);
    await expect(
      orderService.createDispatchSchedule("order-1", { scheduleDate: "fecha-invalida" })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si la fecha es anterior a hoy", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "READY_FOR_DISPATCH" } as any);
    await expect(
      orderService.createDispatchSchedule("order-1", { scheduleDate: "2000-01-01" })
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 409 si ya existe un schedule activo para esa fecha", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "READY_FOR_DISPATCH" } as any);
    prismaMock.dispatchSchedule.findFirst.mockResolvedValueOnce({ id: "existing-sched" } as any);
    await expect(
      orderService.createDispatchSchedule("order-1", { scheduleDate: "2099-01-01" })
    ).rejects.toThrow(AppError);
  });

  it("crea el schedule con prioridad NORMAL por defecto", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "READY_FOR_DISPATCH" } as any);
    prismaMock.dispatchSchedule.findFirst.mockResolvedValueOnce(null);
    prismaMock.dispatchSchedule.create.mockResolvedValueOnce({ id: "new-sched", priority: "NORMAL" } as any);
    await orderService.createDispatchSchedule("order-1", { scheduleDate: "2099-01-01" });
    expect(prismaMock.dispatchSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: "NORMAL" }) })
    );
  });

  it("crea el schedule con prioridad personalizada", async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce({ id: "order-1", status: "READY_FOR_DISPATCH" } as any);
    prismaMock.dispatchSchedule.findFirst.mockResolvedValueOnce(null);
    prismaMock.dispatchSchedule.create.mockResolvedValueOnce({ id: "new-sched", priority: "HIGH" } as any);
    await orderService.createDispatchSchedule("order-1", { scheduleDate: "2099-01-01", priority: "HIGH" });
    expect(prismaMock.dispatchSchedule.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ priority: "HIGH" }) })
    );
  });
});
