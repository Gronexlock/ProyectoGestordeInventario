// ============================================================
// Controlador: Orders
// Delega toda la lógica al servicio; solo maneja HTTP
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as orderService from "../services/order.service";
import { sendSuccess } from "../utils/response";
import { CreateOrderDto } from "../utils/types";

/**
 * POST /orders
 * Crea un pedido en estado PENDING con sus ítems.
 */
export const createOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dto: CreateOrderDto = {
      customerName: req.body.customerName,
      items: req.body.items,
    };

    const order = await orderService.createOrder(dto);

    sendSuccess(res, order, "Pedido creado exitosamente.", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /orders/ready-for-dispatch
 * Retorna pedidos en estado READY_FOR_DISPATCH.
 * Query params opcionales: locationId, dateFrom, dateTo
 */
export const getReadyForDispatch = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orders = await orderService.getReadyForDispatch({
      locationId: typeof req.query.locationId === "string" ? req.query.locationId : undefined,
      dateFrom: typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined,
      dateTo: typeof req.query.dateTo === "string" ? req.query.dateTo : undefined,
    });

    sendSuccess(res, orders, `Se encontraron ${orders.length} pedidos listos para despacho.`);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /orders
 * Lista todos los pedidos con sus ítems.
 */
export const getOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const orders = await orderService.getAllOrders();

    sendSuccess(res, orders, `Se encontraron ${orders.length} pedidos.`);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /orders/:id
 * Retorna el detalle completo de un pedido.
 */
export const getOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await orderService.getOrderById(String(req.params.id));

    sendSuccess(res, order, "Pedido encontrado.");
  } catch (error) {
    next(error);
  }
};

/**
 * POST /orders/:id/dispatch-schedule
 * Crea un DispatchSchedule para el pedido.
 */
export const createDispatchSchedule = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const schedule = await orderService.createDispatchSchedule(String(req.params.id), {
      scheduleDate: req.body.scheduleDate,
      priority: req.body.priority,
    });

    sendSuccess(res, schedule, "DispatchSchedule creado exitosamente.", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /orders/:id/status
 * Transiciona el estado del pedido.
 * Body: { status: "RESERVED" | "READY_FOR_DISPATCH" | ... }
 */
export const updateOrderStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const order = await orderService.transitionOrder(
      String(req.params.id),
      req.body.status
    );

    sendSuccess(res, order, `Estado actualizado a "${req.body.status}".`);
  } catch (error) {
    next(error);
  }
};
