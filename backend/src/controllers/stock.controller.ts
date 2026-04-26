// ============================================================
// Controlador: Stock
// Delega toda la lógica al servicio; solo maneja HTTP
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as stockService from "../services/stock.service";
import { sendSuccess } from "../utils/response";

/**
 * GET /stock
 * Lista todo el stock del sistema (todos los productos en todas las ubicaciones)
 */
export const getAllStock = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const stocks = await stockService.getAllStock();

    sendSuccess(res, stocks, `Se encontraron ${stocks.length} registros de stock.`);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /stock/:locationId
 * Lista el stock de una ubicación específica
 */
export const getStockByLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { locationId } = req.params;
    const result = await stockService.getStockByLocation(locationId);

    sendSuccess(
      res,
      result,
      `Stock de "${result.location.name}": ${result.stocks.length} productos.`
    );
  } catch (error) {
    next(error);
  }
};
