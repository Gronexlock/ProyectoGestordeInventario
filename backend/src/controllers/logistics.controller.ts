// ============================================================
// Controlador: Logistics Simulation
// Delega toda la lógica al servicio; solo maneja HTTP
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as logisticsService from "../services/logistics.service";
import { sendSuccess } from "../utils/response";

export const getLogisticsRoutes = async (
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const routes = await logisticsService.getLogisticsRoutes();

    sendSuccess(res, routes, `Se encontraron ${routes.length} rutas logísticas.`);
  } catch (error) {
    next(error);
  }
};

export const getLogisticsRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await logisticsService.getLogisticsRouteById(
      String(req.params.id)
    );

    sendSuccess(res, route, "Ruta logística encontrada.");
  } catch (error) {
    next(error);
  }
};

export const confirmOrderDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await logisticsService.confirmOrderDelivery(
      String(req.params.id),
      String(req.params.orderId)
    );

    sendSuccess(res, route, "Entrega confirmada exitosamente.");
  } catch (error) {
    next(error);
  }
};

export const completeRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await logisticsService.completeRoute(String(req.params.id));

    sendSuccess(res, route, "Ruta completada exitosamente.");
  } catch (error) {
    next(error);
  }
};
