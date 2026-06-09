import { Request, Response, NextFunction } from "express";
import {
  getSuppliers, createSupplier, getReplenishmentOrders,
  createReplenishmentOrder, updateReplenishmentOrderStatus,
} from "../../controllers/replenishment.controller";
import * as replenishmentService from "../../services/replenishment.service";
import { NotFoundError, ConflictError } from "../../utils/errors";

jest.mock("../../services/replenishment.service");
const mockSvc = replenishmentService as jest.Mocked<typeof replenishmentService>;

const mockRes = () => {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
};
const next: NextFunction = jest.fn();

const mockSupplier = { id: "sup-1", name: "Distrib.", email: "d@d.com", phone: null, createdAt: new Date() };
const mockOrder = {
  id: "order-1", productId: "prod-1", locationId: "loc-1", supplierId: "sup-1",
  quantity: 50, status: "ORDERED" as const, createdAt: new Date(), updatedAt: new Date(),
  product: { name: "Test", sku: "SKU-001" }, location: { name: "Bodega A" }, supplier: { name: "Distrib." },
};

// ─── getSuppliers ──────────────────────────────────────────────────────────────

describe("replenishmentController.getSuppliers", () => {
  it("retorna proveedores", async () => {
    mockSvc.findSuppliers.mockResolvedValueOnce([mockSupplier] as any);
    const res = mockRes();
    await getSuppliers({} as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("propaga error al next", async () => {
    mockSvc.findSuppliers.mockRejectedValueOnce(new Error("DB"));
    await getSuppliers({} as Request, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── createSupplier ───────────────────────────────────────────────────────────

describe("replenishmentController.createSupplier", () => {
  it("crea proveedor y responde 201", async () => {
    mockSvc.createSupplierRecord.mockResolvedValueOnce(mockSupplier as any);
    const req = { body: { name: "Distrib.", email: "d@d.com" } } as Request;
    const res = mockRes();
    await createSupplier(req, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("propaga error al next", async () => {
    mockSvc.createSupplierRecord.mockRejectedValueOnce(new Error("DB"));
    await createSupplier({ body: { name: "X", email: "x@x.com" } } as Request, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── getReplenishmentOrders ───────────────────────────────────────────────────

describe("replenishmentController.getReplenishmentOrders", () => {
  it("retorna órdenes", async () => {
    mockSvc.findReplenishmentOrders.mockResolvedValueOnce([mockOrder] as any);
    const res = mockRes();
    await getReplenishmentOrders({} as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("propaga error al next", async () => {
    mockSvc.findReplenishmentOrders.mockRejectedValueOnce(new Error("DB"));
    await getReplenishmentOrders({} as Request, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ─── createReplenishmentOrder ─────────────────────────────────────────────────

describe("replenishmentController.createReplenishmentOrder", () => {
  const body = { productId: "prod-1", locationId: "loc-1", supplierId: "sup-1", quantity: 50 };

  it("crea orden y responde 201", async () => {
    mockSvc.createOrder.mockResolvedValueOnce(mockOrder as any);
    const res = mockRes();
    await createReplenishmentOrder({ body } as Request, res, next);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("propaga NotFoundError al next", async () => {
    mockSvc.createOrder.mockRejectedValueOnce(new NotFoundError("Producto"));
    await createReplenishmentOrder({ body } as Request, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });
});

// ─── updateReplenishmentOrderStatus ──────────────────────────────────────────

describe("replenishmentController.updateReplenishmentOrderStatus", () => {
  it("cambia a CANCELLED y retorna mensaje genérico", async () => {
    mockSvc.updateOrderStatus.mockResolvedValueOnce({ ...mockOrder, status: "CANCELLED" } as any);
    const req = { params: { id: "order-1" }, body: { status: "CANCELLED" } } as unknown as Request;
    const res = mockRes();
    await updateReplenishmentOrderStatus(req, res, next);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("CANCELLED") })
    );
  });

  it("cambia a RECEIVED y retorna mensaje específico", async () => {
    mockSvc.updateOrderStatus.mockResolvedValueOnce({ ...mockOrder, status: "RECEIVED" } as any);
    const req = { params: { id: "order-1" }, body: { status: "RECEIVED" } } as unknown as Request;
    const res = mockRes();
    await updateReplenishmentOrderStatus(req, res, next);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("RECIBIDA") })
    );
  });

  it("propaga NotFoundError al next", async () => {
    mockSvc.updateOrderStatus.mockRejectedValueOnce(new NotFoundError("Orden"));
    const req = { params: { id: "no-existe" }, body: { status: "CANCELLED" } } as unknown as Request;
    await updateReplenishmentOrderStatus(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(NotFoundError));
  });

  it("propaga ConflictError al next", async () => {
    mockSvc.updateOrderStatus.mockRejectedValueOnce(new ConflictError("Estado final"));
    const req = { params: { id: "order-1" }, body: { status: "CANCELLED" } } as unknown as Request;
    await updateReplenishmentOrderStatus(req, mockRes(), next);
    expect(next).toHaveBeenCalledWith(expect.any(ConflictError));
  });
});
