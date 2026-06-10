import prismaMock from "../__mocks__/prismaClient";
import * as alertService from "../../services/alert.service";
import { NotFoundError } from "../../utils/errors";

const mockAlert = {
  id: "alert-1",
  productId: "prod-1",
  locationId: "loc-1",
  currentStock: 5,
  minStock: 10,
  status: "PENDING" as const,
  createdAt: new Date(),
  resolvedAt: null as Date | null,
  product: { id: "prod-1", name: "Producto Test", sku: "SKU-001", minStock: 10 },
  location: { id: "loc-1", name: "Bodega A", type: "WAREHOUSE" },
};

describe("alertService.findAlerts", () => {
  beforeEach(() => {
    prismaMock.stock.findMany.mockResolvedValue([]);
  });

  it("retorna todas las alertas sin filtro", async () => {
    prismaMock.stockAlert.findMany.mockResolvedValueOnce([mockAlert] as any);

    const result = await alertService.findAlerts();
    expect(result).toEqual([mockAlert]);
    expect(prismaMock.stockAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    );
  });

  it("filtra por estado cuando se provee status", async () => {
    prismaMock.stockAlert.findMany.mockResolvedValueOnce([mockAlert] as any);

    const result = await alertService.findAlerts("PENDING");
    expect(result).toEqual([mockAlert]);
    expect(prismaMock.stockAlert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "PENDING" } })
    );
  });
});

describe("alertService.resolveAlertById", () => {
  it("resuelve una alerta existente", async () => {
    prismaMock.stockAlert.findUnique.mockResolvedValueOnce(mockAlert as any);
    const resolved = { ...mockAlert, status: "RESOLVED" as const, resolvedAt: new Date() };
    prismaMock.stockAlert.update.mockResolvedValueOnce(resolved as any);

    const result = await alertService.resolveAlertById("alert-1");
    expect(result.status).toBe("RESOLVED");
    expect(prismaMock.stockAlert.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "RESOLVED" }) })
    );
  });

  it("lanza NotFoundError si la alerta no existe", async () => {
    prismaMock.stockAlert.findUnique.mockResolvedValueOnce(null);
    await expect(alertService.resolveAlertById("no-existe")).rejects.toThrow(NotFoundError);
  });
});

describe("alertService.syncCriticalAlerts", () => {
  it("crea alerta PENDING cuando el stock físico está en o bajo el mínimo", async () => {
    prismaMock.stock.findMany.mockResolvedValueOnce([
      {
        productId: "prod-1",
        locationId: "loc-1",
        quantity: 5,
        product: { minStock: 5 },
      },
    ] as any);
    prismaMock.stockAlert.findFirst.mockResolvedValueOnce(null);
    prismaMock.stockAlert.create.mockResolvedValueOnce({} as any);

    await alertService.syncCriticalAlerts();

    expect(prismaMock.stockAlert.create).toHaveBeenCalledWith({
      data: {
        productId: "prod-1",
        locationId: "loc-1",
        currentStock: 5,
        minStock: 5,
        status: "PENDING",
      },
    });
  });

  it("resuelve alertas PENDING cuando el stock supera el mínimo", async () => {
    prismaMock.stock.findMany.mockResolvedValueOnce([
      {
        productId: "prod-1",
        locationId: "loc-1",
        quantity: 20,
        product: { minStock: 5 },
      },
    ] as any);
    prismaMock.stockAlert.updateMany.mockResolvedValueOnce({ count: 1 });

    await alertService.syncCriticalAlerts();

    expect(prismaMock.stockAlert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          productId: "prod-1",
          locationId: "loc-1",
          status: "PENDING",
        },
        data: expect.objectContaining({ status: "RESOLVED" }),
      })
    );
  });

  it("actualiza alerta PENDING existente cuando cambia el stock crítico", async () => {
    prismaMock.stock.findMany.mockResolvedValueOnce([
      {
        productId: "prod-1",
        locationId: "loc-1",
        quantity: 3,
        product: { minStock: 10 },
      },
    ] as any);
    prismaMock.stockAlert.findFirst.mockResolvedValueOnce({
      id: "alert-1",
      currentStock: 5,
      minStock: 10,
    } as any);
    prismaMock.stockAlert.update.mockResolvedValueOnce({} as any);

    await alertService.syncCriticalAlerts();

    expect(prismaMock.stockAlert.update).toHaveBeenCalledWith({
      where: { id: "alert-1" },
      data: { currentStock: 3, minStock: 10 },
    });
  });

  it("no actualiza alerta PENDING si los valores ya coinciden", async () => {
    prismaMock.stock.findMany.mockResolvedValueOnce([
      {
        productId: "prod-1",
        locationId: "loc-1",
        quantity: 5,
        product: { minStock: 10 },
      },
    ] as any);
    prismaMock.stockAlert.findFirst.mockResolvedValueOnce({
      id: "alert-1",
      currentStock: 5,
      minStock: 10,
    } as any);

    await alertService.syncCriticalAlerts();

    expect(prismaMock.stockAlert.update).not.toHaveBeenCalled();
    expect(prismaMock.stockAlert.create).not.toHaveBeenCalled();
  });
});
