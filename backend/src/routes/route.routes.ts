// ============================================================
// Rutas: Routes (Rutas de Despacho)
// POST   /routes                        → crear ruta
// GET    /routes                        → listar rutas
// GET    /routes/:id                    → detalle de ruta
// POST   /routes/:id/orders             → asignar órdenes a ruta
// DELETE /routes/:id/orders/:orderId    → remover orden de ruta
// POST   /routes/:id/dispatch           → despachar ruta
// DELETE /routes/:id                    → cancelar ruta
// ============================================================

import { Router } from "express";
import { body, param } from "express-validator";
import * as routeController from "../controllers/route.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router: ReturnType<typeof Router> = Router();

// ── Reglas de validación ───────────────────────────────────────────

const routeIdRule = [
  param("id").isUUID().withMessage("El ID de la ruta debe ser un UUID válido."),
];

const createRouteRules = [
  body("vehicleCode")
    .trim()
    .notEmpty().withMessage("El código de vehículo es requerido.")
    .isLength({ max: 50 }).withMessage("El código de vehículo no puede superar 50 caracteres."),

  body("driverName")
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage("El nombre del conductor no puede superar 100 caracteres."),
];

const assignOrdersRules = [
  param("id").isUUID().withMessage("El ID de la ruta debe ser un UUID válido."),

  body("orderIds")
    .isArray({ min: 1 }).withMessage("Se debe proporcionar al menos una orden."),

  body("orderIds.*")
    .isUUID().withMessage("Cada orderIds debe ser un UUID válido."),
];

const orderParamsRules = [
  param("id").isUUID().withMessage("El ID de la ruta debe ser un UUID válido."),

  param("orderId").isUUID().withMessage("El ID de la orden debe ser un UUID válido."),
];

// ── Rutas ─────────────────────────────────────────────────────────

router.post("/", createRouteRules, validateRequest, routeController.createRoute);
router.get("/", routeController.getRoutes);
router.get("/:id", routeIdRule, validateRequest, routeController.getRoute);
router.post("/:id/orders", assignOrdersRules, validateRequest, routeController.assignOrders);
router.delete("/:id/orders/:orderId", orderParamsRules, validateRequest, routeController.removeOrder);
router.post("/:id/dispatch", routeIdRule, validateRequest, routeController.dispatchRoute);
router.delete("/:id", routeIdRule, validateRequest, routeController.cancelRoute);

export default router;
