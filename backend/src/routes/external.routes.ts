// ============================================================
// Rutas: External (integraciones con otros proyectos)
// PATCH /external/reservations/:id/confirm-delivery → SCRUM-33 (Proyecto 2)
// ============================================================

import { Router } from "express";
import { body, param } from "express-validator";
import * as reservationController from "../controllers/reservation.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router = Router();

const confirmDeliveryRules = [
  param("id")
    .isInt({ min: 1 })
    .withMessage("El ID de reserva debe ser un entero positivo."),
  body("deliveredAt")
    .optional()
    .isISO8601()
    .withMessage("deliveredAt debe ser una fecha ISO 8601 válida."),
  body("note")
    .optional()
    .trim()
    .isLength({ max: 255 })
    .withMessage("La nota no puede superar 255 caracteres."),
];

router.patch(
  "/reservations/:id/confirm-delivery",
  confirmDeliveryRules,
  validateRequest,
  reservationController.confirmDelivery
);

export default router;
