// ============================================================
// Rutas: Locations (Ubicaciones)
// POST /locations    → crear ubicación
// GET  /locations    → listar ubicaciones
// ============================================================

import { Router } from "express";
import { body } from "express-validator";
import * as locationController from "../controllers/location.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router = Router();

/**
 * Reglas de validación para crear una ubicación
 */
const createLocationRules = [
  body("name")
    .trim()
    .notEmpty().withMessage("El nombre es requerido.")
    .isLength({ min: 2, max: 100 }).withMessage("El nombre debe tener entre 2 y 100 caracteres."),

  body("type")
    .trim()
    .notEmpty().withMessage("El tipo es requerido.")
    .isIn(["bodega", "tienda", "almacen", "deposito", "otro"])
    .withMessage("El tipo debe ser: bodega, tienda, almacen, deposito u otro."),

  body("capacity")
    .optional()
    .isInt({ min: 1 }).withMessage("La capacidad debe ser un entero positivo."),
];

// ── Rutas ─────────────────────────────────────────────────────────
router.post("/", createLocationRules, validateRequest, locationController.createLocation);
router.get("/", locationController.getLocations);

export default router;
