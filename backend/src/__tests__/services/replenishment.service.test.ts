import prismaMock from "../__mocks__/prismaClient";
import * as replenishmentService from "../../services/replenishment.service";
import { NotFoundError, ConflictError } from "../../utils/errors";

jest.mock("../../services/event.service", () => ({
  emitStockMovement: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../services/incident.service", () => ({
  notifyIncident: jest.fn(),
}));

import * as eventService from "../../services/event.service";
const mockEmitStockMovement = eventService.emitStockMovement as jest.MockedFunction<typeof eventService.emitStockMovement>;

const mockProduct = { id: "prod-1", name: "Test", sku: "SKU-001", minStock: 10, createdAt: new Date(), updatedAt: new Date() };
const mockLocation = { id: "loc-1", name: "Bodega A", type: "WAREHOUSE", capacity: null, dispatchStart: "08:00", dispatchEnd: "18:00", createdAt: new Date(), updatedAt: new Date() };
const mockSupplier = { id: "sup-1", name: "Distrib. Central", email: "c@c.com", phone: null, createdAt: new Date() };
const mockOrder = {
  id: "order-1", productId: "prod-1", locationId: "loc-1", supplierId: "sup-1",
  quantity: 50, status: "ORDERED" as const, createdAt: new Date(), updatedAt: new Date(),
  product: { name: "Test", sku: "SKU-001" }, location: { name: "Bodega A" }, supplier: { name: "Distrib. Central" },
};

describe("replenishmentService.findSuppliers", () => {
  it("retorna lista de proveedores", async () => {
    prismaMock.supplier.findMany.mockResolvedValueOnce([mockSupplier] as any);
    const result = await replenishmentService.findSuppliers();
    expect(result).toEqual([mockSupplier]);
  });
});

describe("replenishmentService.createSupplierRecord", () => {
  it("crea un proveedor", async () => {
    prismaMock.supplier.create.mockResolvedValueOnce(mockSupplier as any);
    const result = await replenishmentService.createSupplierRecord({ name: "Distrib. Central", email: "c@c.com" });
    expect(result).toEqual(mockSupplier);
  });
});

describe("replenishmentService.findReplenishmentOrders", () => {
  it("retorna lista de órdenes", async () => {
    prismaMock.replenishmentOrder.findMany.mockResolvedValueOnce([mockOrder] as any);
    const result = await replenishmentService.findReplenishmentOrders();
    expect(result).toEqual([mockOrder]);
  });
});

describe("replenishmentService.createOrder", () => {
  const dto = { productId: "prod-1", locationId: "loc-1", supplierId: "sup-1", quantity: 50 };

  it("crea una orden exitosamente", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.supplier.findUnique.mockResolvedValueOnce(mockSupplier as any);
    prismaMock.replenishmentOrder.create.mockResolvedValueOnce(mockOrder as any);
    const result = await replenishmentService.createOrder(dto);
    expect(result).toEqual(mockOrder);
  });

  it("lanza NotFoundError si el producto no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.supplier.findUnique.mockResolvedValueOnce(mockSupplier as any);
    await expect(replenishmentService.createOrder(dto)).rejects.toThrow(NotFoundError);
  });

  it("lanza NotFoundError si la ubicación no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(null);
    prismaMock.supplier.findUnique.mockResolvedValueOnce(mockSupplier as any);
    await expect(replenishmentService.createOrder(dto)).rejects.toThrow(NotFoundError);
  });

  it("lanza NotFoundError si el proveedor no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.supplier.findUnique.mockResolvedValueOnce(null);
    await expect(replenishmentService.createOrder(dto)).rejects.toThrow(NotFoundError);
  });
});

describe("replenishmentService.updateOrderStatus", () => {
  const orderWithProduct = { ...mockOrder, product: { ...mockProduct, minStock: 10 }, location: mockLocation };

  it("lanza NotFoundError si la orden no existe", async () => {
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce(null);
    await expect(replenishmentService.updateOrderStatus("no-existe", "CANCELLED")).rejects.toThrow(NotFoundError);
  });

  it("lanza ConflictError si la orden ya está en estado final RECEIVED", async () => {
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce({ ...orderWithProduct, status: "RECEIVED" } as any);
    await expect(replenishmentService.updateOrderStatus("order-1", "CANCELLED")).rejects.toThrow(ConflictError);
  });

  it("lanza ConflictError si la orden ya está en estado final CANCELLED", async () => {
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce({ ...orderWithProduct, status: "CANCELLED" } as any);
    await expect(replenishmentService.updateOrderStatus("order-1", "ORDERED")).rejects.toThrow(ConflictError);
  });

  it("cancela una orden (cambio simple)", async () => {
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce({ ...orderWithProduct, status: "ORDERED" } as any);
    prismaMock.replenishmentOrder.update.mockResolvedValueOnce({ ...mockOrder, status: "CANCELLED" } as any);
    const result = await replenishmentService.updateOrderStatus("order-1", "CANCELLED");
    expect((result as any).status).toBe("CANCELLED");
  });

  it("marca como RECEIVED: incrementa stock y resuelve alertas si stock > minStock", async () => {
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce({ ...orderWithProduct, status: "ORDERED", quantity: 50 } as any);
    const updatedOrder = { ...mockOrder, status: "RECEIVED" };

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: { upsert: jest.fn().mockResolvedValue({ quantity: 60 }) },
        movement: { create: jest.fn().mockResolvedValue({}) },
        replenishmentOrder: { update: jest.fn().mockResolvedValue(updatedOrder) },
        stockAlert: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      return fn(txMock);
    });

    const result = await replenishmentService.updateOrderStatus("order-1", "RECEIVED");
    expect((result as any).status).toBe("RECEIVED");
  });

  it("marca como RECEIVED sin resolver alertas cuando stock ≤ minStock", async () => {
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce({ ...orderWithProduct, status: "ORDERED", quantity: 5 } as any);
    const alertUpdateMany = jest.fn();

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: { upsert: jest.fn().mockResolvedValue({ quantity: 8 }) },
        movement: { create: jest.fn().mockResolvedValue({}) },
        replenishmentOrder: { update: jest.fn().mockResolvedValue({ ...mockOrder, status: "RECEIVED" }) },
        stockAlert: { updateMany: alertUpdateMany },
      };
      return fn(txMock);
    });

    await replenishmentService.updateOrderStatus("order-1", "RECEIVED");
    expect(alertUpdateMany).not.toHaveBeenCalled();
  });

  it("RECEIVED: emitStockMovement incluye locationName y locationType de la ubicación", async () => {
    mockEmitStockMovement.mockClear();
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce({
      ...orderWithProduct,
      status: "ORDERED",
      quantity: 50,
      location: { ...mockLocation, name: "Bodega Central", type: "WAREHOUSE" },
    } as any);

    prismaMock.$transaction.mockImplementationOnce(async (fn: any) => {
      const txMock = {
        stock: { upsert: jest.fn().mockResolvedValue({ quantity: 60 }) },
        movement: { create: jest.fn().mockResolvedValue({}) },
        replenishmentOrder: { update: jest.fn().mockResolvedValue({ ...mockOrder, status: "RECEIVED" }) },
        stockAlert: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      };
      return fn(txMock);
    });

    await replenishmentService.updateOrderStatus("order-1", "RECEIVED");

    expect(mockEmitStockMovement).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "stock_received",
        locationName: "Bodega Central",
        locationType: "WAREHOUSE",
        sku: "SKU-001",
        quantity: 50,
      })
    );
  });
});

describe("replenishmentService.getReplenishmentSuggestions", () => {
  const mockAlert = {
    id: "alert-1",
    productId: "prod-1",
    locationId: "loc-1",
    currentStock: 5,
    product: { ...mockProduct, minStock: 10, sku: "SKU-001", name: "Test" },
    location: { ...mockLocation, name: "Bodega A" },
  };

  it("retorna lista vacía si no hay alertas pendientes", async () => {
    prismaMock.stockAlert.findMany.mockResolvedValueOnce([]);
    const result = await replenishmentService.getReplenishmentSuggestions();
    expect(result).toEqual([]);
  });

  it("genera sugerencias con proveedor de última orden", async () => {
    prismaMock.stockAlert.findMany.mockResolvedValueOnce([mockAlert] as any);
    (prismaMock.reservation.groupBy as jest.Mock).mockResolvedValueOnce([
      { sku: "SKU-001", locationId: "loc-1", _sum: { quantity: 2 } },
    ]);
    prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 8 } as any);
    prismaMock.replenishmentOrder.findFirst.mockResolvedValueOnce({
      supplierId: "sup-1",
      supplier: { id: "sup-1", name: "Distrib. Central" },
    } as any);

    const result = await replenishmentService.getReplenishmentSuggestions();
    expect(result).toHaveLength(1);
    expect(result[0].suggestedSupplierId).toBe("sup-1");
    expect(result[0].stockDisponible).toBe(6);
    expect(result[0].suggestedQuantity).toBe(14);
  });

  it("usa primer proveedor si no hay órdenes previas", async () => {
    prismaMock.stockAlert.findMany.mockResolvedValueOnce([mockAlert] as any);
    (prismaMock.reservation.groupBy as jest.Mock).mockResolvedValueOnce([]);
    prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 5 } as any);
    prismaMock.replenishmentOrder.findFirst.mockResolvedValueOnce(null);
    prismaMock.supplier.findFirst.mockResolvedValueOnce(mockSupplier as any);

    const result = await replenishmentService.getReplenishmentSuggestions();
    expect(result[0].suggestedSupplierId).toBe("sup-1");
  });

  it("filtra por locationId cuando se indica", async () => {
    prismaMock.stockAlert.findMany.mockResolvedValueOnce([]);
    await replenishmentService.getReplenishmentSuggestions("loc-1");
    expect(prismaMock.stockAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ locationId: "loc-1" }) })
    );
  });
});

describe("replenishmentService.createProposal", () => {
  const dto = { productId: "prod-1", locationId: "loc-1", supplierId: "sup-1", quantity: 20 };

  it("crea propuesta en estado PROPOSED", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.supplier.findUnique.mockResolvedValueOnce(mockSupplier as any);
    prismaMock.replenishmentOrder.create.mockResolvedValueOnce({ ...mockOrder, status: "PROPOSED" } as any);

    const result = await replenishmentService.createProposal(dto);
    expect((result as any).status).toBe("PROPOSED");
    expect(prismaMock.replenishmentOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PROPOSED" }) })
    );
  });

  it("lanza NotFoundError si el producto no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.supplier.findUnique.mockResolvedValueOnce(mockSupplier as any);
    await expect(replenishmentService.createProposal(dto)).rejects.toThrow(NotFoundError);
  });
});

describe("replenishmentService.approveProposal", () => {
  it("aprueba propuesta PROPOSED y pasa a ORDERED", async () => {
    const proposedOrder = {
      id: "order-1",
      status: "PROPOSED",
      productId: "prod-1",
      locationId: "loc-1",
      product: mockProduct,
      location: mockLocation,
    };
    prismaMock.replenishmentOrder.findUnique
      .mockResolvedValueOnce(proposedOrder as any)
      .mockResolvedValueOnce(proposedOrder as any);
    prismaMock.replenishmentOrder.update.mockResolvedValueOnce({ ...mockOrder, status: "ORDERED" } as any);

    const result = await replenishmentService.approveProposal("order-1");
    expect((result as any).status).toBe("ORDERED");
  });

  it("lanza NotFoundError si la orden no existe", async () => {
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce(null);
    await expect(replenishmentService.approveProposal("no-existe")).rejects.toThrow(NotFoundError);
  });

  it("lanza ConflictError si no está en PROPOSED", async () => {
    prismaMock.replenishmentOrder.findUnique.mockResolvedValueOnce({
      id: "order-1",
      status: "ORDERED",
    } as any);
    await expect(replenishmentService.approveProposal("order-1")).rejects.toThrow(ConflictError);
  });
});

describe("replenishmentService.simulateDemand", () => {
  it("calcula simulación con movimientos históricos", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.movement.findMany.mockResolvedValueOnce([
      { quantity: 30, createdAt: new Date() },
      { quantity: 60, createdAt: new Date() },
    ] as any);
    prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 20 } as any);
    prismaMock.reservation.aggregate.mockResolvedValueOnce({ _sum: { quantity: 5 } } as any);

    const result = await replenishmentService.simulateDemand({
      sku: "sku-001",
      locationId: "loc-1",
      horizonDays: 30,
      scenario: "peak",
    });

    expect(result.sku).toBe("SKU-001");
    expect(result.stockDisponible).toBe(15);
    expect(result.scenario).toBe("peak");
    expect(result.historicalOutUnits).toBe(90);
  });

  it("maneja demanda cero (sin quiebre de stock)", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.movement.findMany.mockResolvedValueOnce([]);
    prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 10 } as any);
    prismaMock.reservation.aggregate.mockResolvedValueOnce({ _sum: { quantity: 0 } } as any);

    const result = await replenishmentService.simulateDemand({
      sku: "SKU-001",
      locationId: "loc-1",
    });

    expect(result.daysUntilStockout).toBeNull();
    expect(result.stockoutDate).toBeNull();
  });

  it("lanza NotFoundError si el SKU no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    await expect(
      replenishmentService.simulateDemand({ sku: "NOPE", locationId: "loc-1" })
    ).rejects.toThrow(NotFoundError);
  });

  it("lanza NotFoundError si la ubicación no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.location.findUnique.mockResolvedValueOnce(null);
    await expect(
      replenishmentService.simulateDemand({ sku: "SKU-001", locationId: "no-existe" })
    ).rejects.toThrow(NotFoundError);
  });
});
