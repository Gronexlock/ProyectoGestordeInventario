// ============================================================
// Rutas: Orders (Pedidos de Salida)
// POST  /orders                     → crear pedido
// GET   /orders                     → listar pedidos
// GET   /orders/ready-for-dispatch  → pedidos listos para despacho
// GET   /orders/:id                 → detalle de pedido
// PATCH /orders/:id/status          → transicionar estado
// ============================================================

import { Router } from "express";
import { body, param, query } from "express-validator";
import * as orderController from "../controllers/order.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router: ReturnType<typeof Router> = Router();

const ORDER_STATUSES = [
  "PENDING",
  "RESERVED",
  "READY_FOR_DISPATCH",
  "IN_TRANSIT",
  "DELIVERED",
  "CANCELLED",
];

// ── Reglas de validación ───────────────────────────────────────────

const createOrderRules = [
  body("customerName")
    .trim()
    .notEmpty().withMessage("El nombre del cliente es requerido.")
    .isLength({ max: 100 }).withMessage("El nombre no puede superar 100 caracteres."),

  body("items")
    .isArray({ min: 1 }).withMessage("El pedido debe tener al menos un ítem."),

  body("items.*.productId")
    .trim()
    .notEmpty().withMessage("El productId de cada ítem es requerido.")
    .isUUID().withMessage("El productId debe ser un UUID válido."),

  body("items.*.locationId")
    .trim()
    .notEmpty().withMessage("El locationId de cada ítem es requerido.")
    .isUUID().withMessage("El locationId debe ser un UUID válido."),

  body("items.*.quantity")
    .notEmpty().withMessage("La cantidad de cada ítem es requerida.")
    .isInt({ min: 1 }).withMessage("La cantidad debe ser un entero mayor a cero."),
];

const updateStatusRules = [
  param("id")
    .isUUID().withMessage("El ID del pedido debe ser un UUID válido."),

  body("status")
    .notEmpty().withMessage("El campo status es requerido.")
    .isIn(ORDER_STATUSES).withMessage(
      `El estado debe ser uno de: ${ORDER_STATUSES.join(", ")}.`
    ),
];

const orderIdRule = [
  param("id")
    .isUUID().withMessage("El ID del pedido debe ser un UUID válido."),
];

const readyForDispatchRules = [
  query("locationId")
    .optional()
    .isUUID().withMessage("El locationId debe ser un UUID válido."),

  query("dateFrom")
    .optional()
    .isISO8601().withMessage("dateFrom debe ser una fecha ISO 8601 válida (ej: 2024-01-15)."),

  query("dateTo")
    .optional()
    .isISO8601().withMessage("dateTo debe ser una fecha ISO 8601 válida (ej: 2024-01-15)."),
];

const createDispatchScheduleRules = [
  param("id")
    .isUUID().withMessage("El ID del pedido debe ser un UUID válido."),

  body("scheduleDate")
    .notEmpty().withMessage("La fecha de despacho es requerida.")
    .isISO8601().withMessage("scheduleDate debe ser una fecha ISO 8601 válida (ej: 2026-05-23)."),

  body("priority")
    .optional()
    .isIn(["LOW", "NORMAL", "HIGH", "CRITICAL"])
    .withMessage("priority debe ser LOW, NORMAL, HIGH o CRITICAL."),
];

// ── Rutas ─────────────────────────────────────────────────────────

/**
 * @openapi
 * /orders:
 *   post:
 *     tags: [Orders]
 *     summary: Crear un pedido de salida
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerName, items]
 *             properties:
 *               customerName:
 *                 type: string
 *                 maxLength: 100
 *                 example: Juan Pérez
 *               items:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [productId, locationId, quantity]
 *                   properties:
 *                     productId:
 *                       type: string
 *                       format: uuid
 *                     locationId:
 *                       type: string
 *                       format: uuid
 *                     quantity:
 *                       type: integer
 *                       minimum: 1
 *     responses:
 *       201:
 *         description: Pedido creado y stock reservado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Datos inválidos o stock insuficiente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Orders]
 *     summary: Listar pedidos
 *     responses:
 *       200:
 *         description: Lista de pedidos
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
 *                     $ref: '#/components/schemas/Order'
 *
 * /orders/ready-for-dispatch:
 *   get:
 *     tags: [Orders]
 *     summary: Pedidos listos para despacho
 *     parameters:
 *       - in: query
 *         name: locationId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filtrar por ubicación de origen
 *       - in: query
 *         name: dateFrom
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-15"
 *       - in: query
 *         name: dateTo
 *         schema:
 *           type: string
 *           format: date
 *           example: "2024-01-31"
 *     responses:
 *       200:
 *         description: Pedidos con estado READY_FOR_DISPATCH
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
 *                     $ref: '#/components/schemas/Order'
 *
 * /orders/{id}:
 *   get:
 *     tags: [Orders]
 *     summary: Obtener un pedido por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Pedido encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 * /orders/{id}/status:
 *   patch:
 *     tags: [Orders]
 *     summary: Transicionar el estado de un pedido
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [PENDING, RESERVED, READY_FOR_DISPATCH, IN_TRANSIT, DELIVERED, CANCELLED]
 *     responses:
 *       200:
 *         description: Estado actualizado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Order'
 *       400:
 *         description: Transición de estado inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
/**
 * @openapi
 * /orders/{id}/dispatch-schedule:
 *   post:
 *     tags: [Orders]
 *     summary: Crear un DispatchSchedule para un pedido
 *     description: |
 *       Asocia un schedule de despacho a un pedido en estado READY_FOR_DISPATCH.
 *       Requerido para poder transicionar el pedido a IN_TRANSIT.
 *       No puede haber más de un schedule activo para el mismo pedido en la misma fecha.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [scheduleDate]
 *             properties:
 *               scheduleDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-05-23"
 *               priority:
 *                 type: string
 *                 enum: [LOW, NORMAL, HIGH, CRITICAL]
 *                 default: NORMAL
 *     responses:
 *       201:
 *         description: DispatchSchedule creado exitosamente
 *       400:
 *         description: Pedido no está en READY_FOR_DISPATCH o fecha inválida
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: Pedido no encontrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Ya existe un DispatchSchedule activo para esa fecha
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/", createOrderRules, validateRequest, orderController.createOrder);
router.get("/", orderController.getOrders);
// Debe estar antes de /:id para evitar que Express interprete "ready-for-dispatch" como un id
router.get("/ready-for-dispatch", readyForDispatchRules, validateRequest, orderController.getReadyForDispatch);
router.get("/:id", orderIdRule, validateRequest, orderController.getOrder);
router.patch("/:id/status", updateStatusRules, validateRequest, orderController.updateOrderStatus);
router.post("/:id/dispatch-schedule", createDispatchScheduleRules, validateRequest, orderController.createDispatchSchedule);

export default router;
