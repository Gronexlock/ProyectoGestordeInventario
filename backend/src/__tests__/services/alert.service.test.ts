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
