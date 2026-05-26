// ============================================================
// Controlador: Routes
// Delega toda la lógica al servicio; solo maneja HTTP
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as routeService from "../services/route.service";
import { sendSuccess } from "../utils/response";

export const createRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await routeService.createRoute({
      vehicleCode: req.body.vehicleCode,
      driverName: req.body.driverName,
    });

    sendSuccess(res, route, "Ruta creada exitosamente.", 201);
  } catch (error) {
    next(error);
  }
};

export const getRoutes = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const routes = await routeService.getRoutes();

    sendSuccess(res, routes, `Se encontraron ${routes.length} rutas.`);
  } catch (error) {
    next(error);
  }
};

export const getRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await routeService.getRouteById(String(req.params.id));

    sendSuccess(res, route, "Ruta encontrada.");
  } catch (error) {
    next(error);
  }
};

export const assignOrders = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await routeService.assignOrdersToRoute(
      String(req.params.id),
      req.body.orderIds
    );

    sendSuccess(res, route, "Órdenes asignadas a la ruta exitosamente.");
  } catch (error) {
    next(error);
  }
};

export const removeOrder = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await routeService.removeOrderFromRoute(
      String(req.params.id),
      String(req.params.orderId)
    );

    sendSuccess(res, route, "Orden removida de la ruta exitosamente.");
  } catch (error) {
    next(error);
  }
};

export const dispatchRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await routeService.dispatchRoute(String(req.params.id));

    sendSuccess(res, route, "Ruta despachada exitosamente.");
  } catch (error) {
    next(error);
  }
};

export const cancelRoute = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const route = await routeService.cancelRoute(String(req.params.id));

    sendSuccess(res, route, "Ruta cancelada exitosamente.");
  } catch (error) {
    next(error);
  }
};
