import prismaMock from "../__mocks__/prismaClient";
import * as stockService from "../../services/stock.service";
import { AppError } from "../../utils/AppError";

const mockProduct = { id: "prod-1", name: "Prod Test", sku: "SKU-001", minStock: 10 };
const mockLocation = { id: "loc-1", name: "Bodega A", type: "WAREHOUSE", priority: 1 };
const mockStock = {
  productId: "prod-1",
  locationId: "loc-1",
  quantity: 50,
  reserved: 5,
  product: { id: "prod-1", name: "Prod Test", sku: "SKU-001", minStock: 10 },
  location: { id: "loc-1", name: "Bodega A", type: "WAREHOUSE" },
};

// ── reserveStock ──────────────────────────────────────────────

describe("stockService.reserveStock", () => {
  it("lanza AppError 400 si no existe stock para el producto/ubicación", async () => {
    prismaMock.stock.findUnique.mockResolvedValueOnce(null);
    await expect(
      stockService.reserveStock(prismaMock as any, [
        { productId: "prod-1", locationId: "loc-1", quantity: 5 },
      ])
    ).rejects.toThrow(AppError);
  });

  it("lanza AppError 400 si el stock disponible es insuficiente", async () => {
    prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 10, reserved: 8 } as any);
    await expect(
      stockService.reserveStock(prismaMock as any, [
        { productId: "prod-1", locationId: "loc-1", quantity: 5 },
      ])
    ).rejects.toThrow(AppError);
  });

  it("incrementa reserved cuando hay stock disponible suficiente", async () => {
    prismaMock.stock.findUnique.mockResolvedValueOnce({ quantity: 50, reserved: 5 } as any);
    prismaMock.stock.update.mockResolvedValueOnce(mockStock as any);
    await stockService.reserveStock(prismaMock as any, [
      { productId: "prod-1", locationId: "loc-1", quantity: 10 },
    ]);
    expect(prismaMock.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reserved: { increment: 10 } } })
    );
  });

  it("procesa múltiples ítems correctamente", async () => {
    prismaMock.stock.findUnique
      .mockResolvedValueOnce({ quantity: 50, reserved: 0 } as any)
      .mockResolvedValueOnce({ quantity: 30, reserved: 0 } as any);
    prismaMock.stock.update.mockResolvedValue(mockStock as any);
    await stockService.reserveStock(prismaMock as any, [
      { productId: "prod-1", locationId: "loc-1", quantity: 5 },
      { productId: "prod-2", locationId: "loc-2", quantity: 3 },
    ]);
    expect(prismaMock.stock.update).toHaveBeenCalledTimes(2);
  });
});

// ── releaseStock ──────────────────────────────────────────────

describe("stockService.releaseStock", () => {
  it("decrementa reserved para cada ítem", async () => {
    prismaMock.stock.update.mockResolvedValueOnce(mockStock as any);
    await stockService.releaseStock(prismaMock as any, [
      { productId: "prod-1", locationId: "loc-1", quantity: 5 },
    ]);
    expect(prismaMock.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { reserved: { decrement: 5 } } })
    );
  });
});

// ── deductStock ──────────────────────────────────────────────

describe("stockService.deductStock", () => {
  it("decrementa quantity y reserved, y crea movimiento OUT", async () => {
    prismaMock.stock.update.mockResolvedValueOnce(mockStock as any);
    prismaMock.movement.create.mockResolvedValueOnce({ id: "mov-1" } as any);
    await stockService.deductStock(
      prismaMock as any,
      [{ productId: "prod-1", locationId: "loc-1", quantity: 10 }],
      "order-1"
    );
    expect(prismaMock.stock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { quantity: { decrement: 10 }, reserved: { decrement: 10 } },
      })
    );
    expect(prismaMock.movement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "OUT", quantity: 10, note: "Despacho pedido order-1" }),
      })
    );
  });
});

// ── getAllStock ──────────────────────────────────────────────

describe("stockService.getAllStock", () => {
  it("retorna stock con disponibilidad calculada desde el mapa de reservas", async () => {
    prismaMock.stock.findMany.mockResolvedValueOnce([mockStock] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([
      { sku: "SKU-001", locationId: "loc-1", _sum: { quantity: 5 } },
    ]);
    const result = await stockService.getAllStock();
    expect(result[0].reserved).toBe(5);
    expect(result[0].stockDisponible).toBe(45);
  });

  it("usa 0 para reserved cuando no hay entradas en el mapa de reservas", async () => {
    prismaMock.stock.findMany.mockResolvedValueOnce([mockStock] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([]);
    const result = await stockService.getAllStock();
    expect(result[0].reserved).toBe(0);
    expect(result[0].stockDisponible).toBe(50);
  });
});

// ── getStockByLocation ──────────────────────────────────────────────

describe("stockService.getStockByLocation", () => {
  it("lanza AppError 404 si la ubicación no existe", async () => {
    prismaMock.location.findUnique.mockResolvedValueOnce(null);
    await expect(stockService.getStockByLocation("no-existe")).rejects.toThrow(AppError);
  });

  it("retorna location y stocks con disponibilidad calculada", async () => {
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.stock.findMany.mockResolvedValueOnce([mockStock] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([]);
    const result = await stockService.getStockByLocation("loc-1");
    expect(result.location).toEqual(mockLocation);
    expect(result.stocks[0].stockDisponible).toBe(50);
  });

  it("calcula disponibilidad con reservas activas en la ubicación", async () => {
    prismaMock.location.findUnique.mockResolvedValueOnce(mockLocation as any);
    prismaMock.stock.findMany.mockResolvedValueOnce([mockStock] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([
      { sku: "SKU-001", locationId: "loc-1", _sum: { quantity: 10 } },
    ]);
    const result = await stockService.getStockByLocation("loc-1");
    expect(result.stocks[0].reserved).toBe(10);
    expect(result.stocks[0].stockDisponible).toBe(40);
  });
});

// ── suggestSourceLocation ──────────────────────────────────────────────

describe("stockService.suggestSourceLocation", () => {
  it("lanza AppError 404 si el producto no existe", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(null);
    await expect(stockService.suggestSourceLocation("no-existe")).rejects.toThrow(AppError);
  });

  it("retorna lista vacía si ninguna ubicación tiene stock suficiente", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.stock.findMany.mockResolvedValueOnce([
      { productId: "prod-1", locationId: "loc-1", quantity: 1, location: mockLocation },
    ] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([]);
    const result = await stockService.suggestSourceLocation("prod-1", 10);
    expect(result).toHaveLength(0);
  });

  it("ordena por prioridad ascendente primero", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.stock.findMany.mockResolvedValueOnce([
      { productId: "prod-1", locationId: "loc-1", quantity: 30, location: { id: "loc-1", name: "A", type: "W", priority: 2 } },
      { productId: "prod-1", locationId: "loc-2", quantity: 20, location: { id: "loc-2", name: "B", type: "W", priority: 1 } },
    ] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([]);
    const result = await stockService.suggestSourceLocation("prod-1", 1);
    expect(result[0].location.priority).toBe(1);
    expect(result[1].location.priority).toBe(2);
    expect(result[0].rank).toBe(1);
    expect(result[1].rank).toBe(2);
  });

  it("ordena por stockDisponible descendente cuando prioridad es igual", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.stock.findMany.mockResolvedValueOnce([
      { productId: "prod-1", locationId: "loc-1", quantity: 10, location: { id: "loc-1", name: "A", type: "W", priority: 1 } },
      { productId: "prod-1", locationId: "loc-2", quantity: 30, location: { id: "loc-2", name: "B", type: "W", priority: 1 } },
    ] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([]);
    const result = await stockService.suggestSourceLocation("prod-1", 1);
    expect(result[0].quantity).toBe(30);
    expect(result[1].quantity).toBe(10);
  });

  it("descuenta reservas activas del stockDisponible al filtrar", async () => {
    prismaMock.product.findUnique.mockResolvedValueOnce(mockProduct as any);
    prismaMock.stock.findMany.mockResolvedValueOnce([
      { productId: "prod-1", locationId: "loc-1", quantity: 10, location: mockLocation },
    ] as any);
    // Todas las unidades están reservadas
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([
      { sku: "SKU-001", locationId: "loc-1", _sum: { quantity: 10 } },
    ]);
    const result = await stockService.suggestSourceLocation("prod-1", 5);
    expect(result).toHaveLength(0);
  });
});
