// ============================================================
// Controlador: Reservations
// ============================================================

import { Request, Response, NextFunction } from "express";
import { ReservationStatus } from "@prisma/client";
import * as reservationService from "../services/reservation.service";
import { sendSuccess } from "../utils/response";
import {
  CreateReservationDto,
  ReleaseReservationDto,
  ConfirmDeliveryDto,
} from "../utils/types";

/**
 * POST /reservations — Mock Proyecto 3: crear reserva
 */
export const createReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dto: CreateReservationDto = {
      orderId: req.body.orderId,
      sku: req.body.sku,
      locationId: req.body.locationId,
      quantity: req.body.quantity,
      expiresAt: req.body.expiresAt,
    };

    const result = await reservationService.createReservation(dto);

    sendSuccess(res, result, "Reserva creada exitosamente.", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /reservations — Listar reservas (filtro ?status=ACTIVE)
 */
export const getReservations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const statusParam = req.query.status as string | undefined;
    const status = statusParam
      ? (statusParam.toUpperCase() as ReservationStatus)
      : undefined;

    const reservations = await reservationService.getAllReservations(status);

    sendSuccess(
      res,
      reservations,
      `Se encontraron ${reservations.length} reservas.`
    );
  } catch (error) {
    next(error);
  }
};

/**
 * POST /release-reservation — SCRUM-20: cancelar + liberar en un paso
 */
export const releaseReservation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dto: ReleaseReservationDto = {
      reservationId: req.body.reservationId,
    };

    const result = await reservationService.cancelAndReleaseReservation(dto);

    const message = result.alreadyReleased
      ? "La reserva ya estaba liberada."
      : "Reserva cancelada y liberada. Stock disponible actualizado.";

    sendSuccess(res, result, message);
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /external/reservations/:id/confirm-delivery — SCRUM-33: Proyecto 2
 */
export const confirmDelivery = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const reservationId = parseInt(req.params.id as string, 10);
    const dto: ConfirmDeliveryDto = {
      deliveredAt: req.body.deliveredAt,
      note: req.body.note,
    };

    const result = await reservationService.confirmDelivery(
      reservationId,
      dto
    );

    let message: string;
    if (result.alreadySold) {
      message = "La entrega ya había sido confirmada previamente.";
    } else if ("alert" in result && result.alert) {
      message = `Entrega confirmada. Inventario marcado como vendido. ${result.alert}`;
    } else {
      message = "Entrega confirmada. Inventario marcado como vendido.";
    }

    sendSuccess(res, result, message);
  } catch (error) {
    next(error);
  }
};
