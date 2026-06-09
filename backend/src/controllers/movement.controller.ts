// ============================================================
// Controlador: Movements
// Delega toda la lógica al servicio; solo maneja HTTP
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as movementService from "../services/movement.service";
import { sendSuccess } from "../utils/response";
import { CreateMovementDto } from "../utils/types";

/**
 * POST /movements
 * Registra un movimiento de inventario (IN o OUT)
 * Actualiza automáticamente el stock correspondiente
 */
export const createMovement = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dto: CreateMovementDto = {
      productId: req.body.productId,
      locationId: req.body.locationId,
      type: req.body.type,
      quantity: req.body.quantity,
      note: req.body.note,
    };

    const result = await movementService.createMovement(dto);

    // El mensaje incluye la alerta si el stock es crítico
    const message = result.alert
      ? `Movimiento registrado. ${result.alert}`
      : "Movimiento registrado exitosamente.";

    sendSuccess(res, result, message, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /movements/transfer
 * Registra una transferencia atómica entre dos ubicaciones
 */
export const createTransfer = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dto = {
      productId: req.body.productId,
      sourceLocationId: req.body.sourceLocationId,
      destinationLocationId: req.body.destinationLocationId,
      quantity: req.body.quantity,
      note: req.body.note,
    };

    const result = await movementService.createTransfer(dto);

    sendSuccess(
      res,
      result,
      "Transferencia de inventario realizada exitosamente.",
      201
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /movements
 * Historial de todos los movimientos registrados
 */
export const getMovements = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const movements = await movementService.getAllMovements();

    sendSuccess(res, movements, `Se encontraron ${movements.length} movimientos.`);
  } catch (error) {
    next(error);
  }
};
