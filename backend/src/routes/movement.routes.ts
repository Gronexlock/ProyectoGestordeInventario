// ============================================================
// Rutas: Movements (Movimientos de Inventario)
// POST /movements          → registrar movimiento (IN/OUT)
// POST /movements/transfer → registrar transferencia entre ubicaciones
// GET  /movements          → historial de movimientos
// ============================================================

import { Router } from "express";
import { body } from "express-validator";
import * as movementController from "../controllers/movement.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router: Router = Router();

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

const createTransferRules = [
  body("productId")
    .trim()
    .notEmpty().withMessage("El ID del producto es requerido.")
    .isUUID().withMessage("El productId debe ser un UUID válido."),

  body("sourceLocationId")
    .trim()
    .notEmpty().withMessage("El ID de la ubicación origen es requerido.")
    .isUUID().withMessage("El sourceLocationId debe ser un UUID válido."),

  body("destinationLocationId")
    .trim()
    .notEmpty().withMessage("El ID de la ubicación destino es requerido.")
    .isUUID().withMessage("El destinationLocationId debe ser un UUID válido."),

  body("quantity")
    .notEmpty().withMessage("La cantidad es requerida.")
    .isInt({ min: 1 }).withMessage("La cantidad debe ser un entero mayor a cero."),

  body("note")
    .optional()
    .trim()
    .isLength({ max: 255 }).withMessage("La nota no puede superar 255 caracteres."),
];

router.post("/", createMovementRules, validateRequest, movementController.createMovement);
router.post("/transfer", createTransferRules, validateRequest, movementController.createTransfer);
router.get("/", movementController.getMovements);

export default router;
