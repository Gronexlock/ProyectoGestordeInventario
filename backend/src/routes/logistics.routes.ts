// ============================================================
// Rutas: Logistics Simulation (simulación de Proyecto 2)
// GET    /logistics/routes                              → rutas DISPATCHED/COMPLETED con progreso
// GET    /logistics/routes/:id                         → detalle de ruta con estado por orden
// POST   /logistics/routes/:id/orders/:orderId/deliver → confirmar entrega individual
// POST   /logistics/routes/:id/complete                → completar ruta en bulk
// ============================================================

import { Router } from "express";
import { param } from "express-validator";
import * as logisticsController from "../controllers/logistics.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router = Router();

// ── Reglas de validación ───────────────────────────────────────────

const routeIdRule = [
  param("id").isUUID().withMessage("El ID de la ruta debe ser un UUID válido."),
];

const deliverOrderRules = [
  param("id").isUUID().withMessage("El ID de la ruta debe ser un UUID válido."),
  param("orderId").isUUID().withMessage("El ID de la orden debe ser un UUID válido."),
];

// ── Rutas ─────────────────────────────────────────────────────────

router.get("/routes", logisticsController.getLogisticsRoutes);
router.get("/routes/:id", routeIdRule, validateRequest, logisticsController.getLogisticsRoute);
router.post("/routes/:id/orders/:orderId/deliver", deliverOrderRules, validateRequest, logisticsController.confirmOrderDelivery);
router.post("/routes/:id/complete", routeIdRule, validateRequest, logisticsController.completeRoute);

export default router;
