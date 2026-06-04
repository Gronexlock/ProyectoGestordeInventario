// ============================================================
// Rutas: Movements (Movimientos de Inventario)
// POST /movements   → registrar movimiento
// GET  /movements   → historial de movimientos
// ============================================================

import { Router } from "express";
import { body } from "express-validator";
import * as movementController from "../controllers/movement.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router: Router = Router();

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

/**
 * @openapi
 * /movements:
 *   post:
 *     tags: [Movements]
 *     summary: Registrar un movimiento de inventario
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [productId, locationId, type, quantity]
 *             properties:
 *               productId:
 *                 type: string
 *                 format: uuid
 *               locationId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [IN, OUT]
 *                 example: IN
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *                 example: 10
 *               note:
 *                 type: string
 *                 maxLength: 255
 *                 example: Reposición semanal
 *     responses:
 *       201:
 *         description: Movimiento registrado y stock actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Movement'
 *       400:
 *         description: Datos inválidos o stock insuficiente para OUT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Producto o ubicación no encontrados
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Movements]
 *     summary: Listar historial de movimientos
 *     responses:
 *       200:
 *         description: Lista de movimientos ordenados por fecha descendente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Movement'
 */
router.post("/", createMovementRules, validateRequest, movementController.createMovement);
router.get("/", movementController.getMovements);

export default router;
