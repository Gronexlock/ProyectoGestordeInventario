// ============================================================
// Rutas: Stock (Inventario)
// GET /stock               → todo el stock
// GET /stock/:locationId   → stock de una ubicación
// ============================================================

import { Router } from "express";
import * as stockController from "../controllers/stock.controller";

const router: Router = Router();

// ── Rutas ─────────────────────────────────────────────────────────
router.get("/", stockController.getAllStock);
router.get("/:locationId", stockController.getStockByLocation);

export default router;
