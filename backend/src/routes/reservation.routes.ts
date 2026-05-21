// ============================================================
// Rutas: Reservations
// POST   /reservations         → crear reserva (mock Proyecto 3)
// GET    /reservations         → listar reservas
// POST   /release-reservation  → cancelar + liberar (SCRUM-20)
// ============================================================

import { Router } from "express";
import { body, query } from "express-validator";
import * as reservationController from "../controllers/reservation.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router = Router();

const createReservationRules = [
  body("orderId")
    .isInt({ min: 1 })
    .withMessage("orderId debe ser un entero positivo."),
  body("sku")
    .trim()
    .notEmpty()
    .withMessage("El SKU es requerido."),
  body("locationId")
    .trim()
    .notEmpty()
    .withMessage("locationId es requerido.")
    .isUUID()
    .withMessage("locationId debe ser un UUID válido."),
  body("quantity")
    .isInt({ min: 1 })
    .withMessage("quantity debe ser un entero mayor a cero."),
  body("expiresAt")
    .optional()
    .isISO8601()
    .withMessage("expiresAt debe ser una fecha ISO 8601 válida."),
];

const releaseReservationRules = [
  body("reservationId")
    .isInt({ min: 1 })
    .withMessage("reservationId debe ser un entero positivo."),
];

const listReservationRules = [
  query("status")
    .optional()
    .isIn(["ACTIVE", "RELEASED", "SOLD", "EXPIRED"])
    .withMessage("status debe ser ACTIVE, RELEASED, SOLD o EXPIRED."),
];

router.post(
  "/",
  createReservationRules,
  validateRequest,
  reservationController.createReservation
);

router.get(
  "/",
  listReservationRules,
  validateRequest,
  reservationController.getReservations
);

export default router;

// Ruta separada montada en app.ts como /release-reservation
export const releaseReservationRouter = Router();

releaseReservationRouter.post(
  "/",
  releaseReservationRules,
  validateRequest,
  reservationController.releaseReservation
);
