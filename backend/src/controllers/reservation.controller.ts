import { Request, Response, NextFunction } from "express";
import * as reservationService from "../services/reservation.service";
import { sendSuccess } from "../utils/response";
import { AppError } from "../utils/AppError";

/**
 * Crea una reserva temporal para un pedido
 */
export const createTemporaryReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { orderId, sku, locationId, quantity } = req.body;

    if (!orderId || !sku || !locationId || !quantity) {
      throw new AppError("Faltan campos requeridos: orderId, sku, locationId, quantity", 400);
    }

    const reservation = await reservationService.createTemporaryReservation({
      orderId,
      sku,
      locationId,
      quantity,
    });

    sendSuccess(res, reservation, "Reserva temporal creada exitosamente. Esperando pago.", 201);
  } catch (error) {
    next(error);
  }
};
