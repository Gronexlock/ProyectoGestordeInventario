// ============================================================
// Rutas: Movements (Movimientos de Inventario)
// POST /movements   → registrar movimiento
// GET  /movements   → historial de movimientos
// ============================================================

import { Router } from "express";
import { body } from "express-validator";
import * as movementController from "../controllers/movement.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router = Router();

/**
 * Reglas de validación para registrar un movimiento
 */
const createMovementRules = [
  body("productId")
    .trim()
    .notEmpty().withMessage("El ID del producto es requerido.")
    .isUUID().withMessage("El productId debe ser un UUID válido."),

  body("locationId")
    .trim()
    .notEmpty().withMessage("El ID de la ubicación es requerido.")
    .isUUID().withMessage("El locationId debe ser un UUID válido."),

  body("type")
    .notEmpty().withMessage("El tipo de movimiento es requerido.")
    .isIn(["IN", "OUT"]).withMessage("El tipo debe ser 'IN' (entrada) o 'OUT' (salida)."),

  body("quantity")
    .notEmpty().withMessage("La cantidad es requerida.")
    .isInt({ min: 1 }).withMessage("La cantidad debe ser un entero mayor a cero."),

  body("note")
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage("La nota no puede superar 255 caracteres."),
];

// ── Rutas ─────────────────────────────────────────────────────────
router.post("/", createMovementRules, validateRequest, movementController.createMovement);
router.get("/", movementController.getMovements);

export default router;
