import prismaMock from "../__mocks__/prismaClient";
import * as syncService from "../../services/sync.service";
import * as movementService from "../../services/movement.service";
import { AppError } from "../../utils/AppError";

jest.mock("../../services/movement.service");

const mockedCreateTransfer = movementService.createTransfer as jest.MockedFunction<typeof movementService.createTransfer>;

const loc1 = { id: "loc-1", name: "Bodega Central", type: "bodega", priority: 1 };
const loc2 = { id: "loc-2", name: "Tienda Norte",   type: "tienda", priority: 3 };

const makeProduct = (stocks: Array<{ locationId: string; quantity: number; location: typeof loc1 }>) => ({
  id: "prod-1",
  name: "Producto Test",
  sku: "SKU-001",
  minStock: 5,
  stocks: stocks.map((s) => ({ ...s, productId: "prod-1" })),
});

// ── getStockBalance ───────────────────────────────────────────

describe("syncService.getStockBalance", () => {
  it("retorna lista vacía si todos los productos tienen < 2 ubicaciones", async () => {
    const product = makeProduct([{ locationId: "loc-1", quantity: 20, location: loc1 }]);
    prismaMock.product.findMany.mockResolvedValueOnce([product] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([]);

    const result = await syncService.getStockBalance();
    expect(result).toEqual([]);
  });

  it("detecta EXCESS y DEFICIT entre dos ubicaciones", async () => {
    const product = makeProduct([
      { locationId: "loc-1", quantity: 50, location: loc1 },
      { locationId: "loc-2", quantity: 2, location: loc2 },
    ]);
    prismaMock.product.findMany.mockResolvedValueOnce([product] as any);
    // Sin reservas activas
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([]);

    const result = await syncService.getStockBalance();
    expect(result).toHaveLength(1);

    const locs = result[0].locations;
    const excess = locs.find((l) => l.status === "EXCESS");
    const deficit = locs.find((l) => l.status === "DEFICIT");
    expect(excess).toBeDefined();
    expect(deficit).toBeDefined();
    expect(result[0].suggestedTransfers.length).toBeGreaterThan(0);
  });

  it("no incluye productos OK en el resultado", async () => {
    const product = makeProduct([
      { locationId: "loc-1", quantity: 20, location: loc1 },
      { locationId: "loc-2", quantity: 20, location: loc2 },
    ]);
    prismaMock.product.findMany.mockResolvedValueOnce([product] as any);
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([]);

    const result = await syncService.getStockBalance();
    expect(result).toEqual([]);
  });

  it("no genera transferencias si el exceso tiene stockDisponible=0 (todo reservado)", async () => {
    const product = makeProduct([
      { locationId: "loc-1", quantity: 50, location: loc1 },
      { locationId: "loc-2", quantity: 2, location: loc2 },
    ]);
    prismaMock.product.findMany.mockResolvedValueOnce([product] as any);
    // loc-1 tiene todo su stock reservado: disponible=0
    (prismaMock.reservation.groupBy as jest.MockedFunction<any>).mockResolvedValueOnce([
      { sku: "SKU-001", locationId: "loc-1", _sum: { quantity: 50 } },
    ]);

    const result = await syncService.getStockBalance();
    // Se detecta déficit pero no hay transferencia posible (exceso con disponible=0)
    const prod = result.find((p) => p.productId === "prod-1");
    if (prod) {
      expect(prod.suggestedTransfers).toHaveLength(0);
    }
  });
});

// ── executeSuggestedTransfer ──────────────────────────────────

describe("syncService.executeSuggestedTransfer", () => {
  it("llama a createTransfer con nota automática", async () => {
    const mockResult = { movement: {}, updatedStock: {} };
    mockedCreateTransfer.mockResolvedValueOnce(mockResult as any);

    await syncService.executeSuggestedTransfer({
      productId: "prod-1",
      sourceLocationId: "loc-1",
      destinationLocationId: "loc-2",
      quantity: 10,
    });

    expect(mockedCreateTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        note: "Sincronización automática de balance entre almacenes",
        productId: "prod-1",
        quantity: 10,
      })
    );
  });

  it("propaga errores de createTransfer", async () => {
    mockedCreateTransfer.mockRejectedValueOnce(new AppError("Stock insuficiente", 400));

    await expect(
      syncService.executeSuggestedTransfer({
        productId: "prod-1",
        sourceLocationId: "loc-1",
        destinationLocationId: "loc-2",
        quantity: 999,
      })
    ).rejects.toThrow(AppError);
  });
});
