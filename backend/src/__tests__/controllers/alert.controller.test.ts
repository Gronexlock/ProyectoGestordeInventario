import { Request, Response, NextFunction } from "express";
import { getAlerts, resolveAlert } from "../../controllers/alert.controller";
import * as alertService from "../../services/alert.service";
import { NotFoundError } from "../../utils/errors";

jest.mock("../../services/alert.service");
const mockAlertService = alertService as jest.Mocked<typeof alertService>;

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};
const mockNext: NextFunction = jest.fn();

const mockAlert = {
  id: "alert-1", productId: "prod-1", locationId: "loc-1",
  currentStock: 5, minStock: 10, status: "PENDING" as const,
  createdAt: new Date(), resolvedAt: null as Date | null,
  product: { id: "prod-1", name: "Producto Test", sku: "SKU-001", minStock: 10 },
  location: { id: "loc-1", name: "Bodega A", type: "WAREHOUSE" },
};

describe("alertController.getAlerts", () => {
  it("retorna alertas sin filtro de estado", async () => {
    mockAlertService.findAlerts.mockResolvedValueOnce([mockAlert] as any);
    const req = { query: {} } as Request;
    const res = mockRes();

    await getAlerts(req, res, mockNext);

    expect(mockAlertService.findAlerts).toHaveBeenCalledWith(undefined);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("filtra por estado PENDING", async () => {
    mockAlertService.findAlerts.mockResolvedValueOnce([mockAlert] as any);
    const req = { query: { status: "PENDING" } } as unknown as Request;
    const res = mockRes();

    await getAlerts(req, res, mockNext);

    expect(mockAlertService.findAlerts).toHaveBeenCalledWith("PENDING");
  });

  it("llama a next(error) cuando el servicio falla", async () => {
    const err = new Error("DB error");
    mockAlertService.findAlerts.mockRejectedValueOnce(err);
    await getAlerts({ query: {} } as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(err);
  });
});

describe("alertController.resolveAlert", () => {
  it("resuelve una alerta correctamente", async () => {
    const resolved = { ...mockAlert, status: "RESOLVED" as const, resolvedAt: new Date() };
    mockAlertService.resolveAlertById.mockResolvedValueOnce(resolved as any);

    const req = { params: { id: "alert-1" } } as unknown as Request;
    const res = mockRes();

    await resolveAlert(req, res, mockNext);

    expect(mockAlertService.resolveAlertById).toHaveBeenCalledWith("alert-1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("propaga NotFoundError al next cuando la alerta no existe", async () => {
    mockAlertService.resolveAlertById.mockRejectedValueOnce(new NotFoundError("Alerta", "no-existe"));
    await resolveAlert({ params: { id: "no-existe" } } as unknown as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it("llama a next(error) ante error inesperado del servicio", async () => {
    mockAlertService.resolveAlertById.mockRejectedValueOnce(new Error("DB error"));
    await resolveAlert({ params: { id: "alert-1" } } as unknown as Request, mockRes(), mockNext);
    expect(mockNext).toHaveBeenCalledWith(expect.any(Error));
  });
});
