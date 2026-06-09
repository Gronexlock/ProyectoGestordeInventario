import { Request, Response, NextFunction } from "express";
import * as replenishmentService from "../services/replenishment.service";
import { sendSuccess } from "../utils/response";

export const getSuppliers = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const suppliers = await replenishmentService.findSuppliers();
    sendSuccess(res, suppliers, `Se encontraron ${suppliers.length} proveedores.`);
  } catch (error) {
    next(error);
  }
};

export const createSupplier = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, phone } = req.body as { name: string; email: string; phone?: string };
    const supplier = await replenishmentService.createSupplierRecord({ name, email, phone });
    sendSuccess(res, supplier, "Proveedor creado exitosamente.", 201);
  } catch (error) {
    next(error);
  }
};

export const getReplenishmentOrders = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orders = await replenishmentService.findReplenishmentOrders();
    sendSuccess(res, orders, `Se encontraron ${orders.length} órdenes de reposición.`);
  } catch (error) {
    next(error);
  }
};

export const createReplenishmentOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { productId, locationId, supplierId, quantity } = req.body as {
      productId: string;
      locationId: string;
      supplierId: string;
      quantity: number;
    };
    const order = await replenishmentService.createOrder({ productId, locationId, supplierId, quantity });
    sendSuccess(res, order, "Orden de reposición creada y solicitada.", 201);
  } catch (error) {
    next(error);
  }
};

export const updateReplenishmentOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = String(req.params.id);
    const { status } = req.body as { status: string };
    const order = await replenishmentService.updateOrderStatus(id, status);

    const message = status === "RECEIVED"
      ? "Orden marcada como RECIBIDA. Stock incrementado e historial actualizado."
      : `Orden de reposición actualizada a: ${status}.`;

    sendSuccess(res, order, message);
  } catch (error) {
    next(error);
  }
};
