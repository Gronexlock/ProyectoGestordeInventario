import prismaMock from "../__mocks__/prismaClient";
import * as replenishmentService from "../../services/replenishment.service";
import { NotFoundError, ConflictError } from "../../utils/errors";

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
});
