// ============================================================
// Rutas: Locations (Ubicaciones)
// POST   /locations       → crear ubicación
// GET    /locations       → listar ubicaciones
// GET    /locations/:id   → obtener ubicación por ID
// PUT    /locations/:id   → actualizar ubicación
// DELETE /locations/:id   → eliminar ubicación
// ============================================================

import { Router } from "express";
import { body, param } from "express-validator";
import * as locationController from "../controllers/location.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router: Router = Router();

// ── Validaciones reutilizables ────────────────────────────────────

const idParamRules = [
  param("id").isUUID().withMessage("El ID debe ser un UUID válido."),
];

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

const updateLocationRules = [
  body("name")
    .optional()
    .trim()
    .isLength({ min: 2, max: 100 }).withMessage("El nombre debe tener entre 2 y 100 caracteres."),

  body("type")
    .optional()
    .trim()
    .isIn(["bodega", "tienda", "almacen", "deposito", "otro"])
    .withMessage("El tipo debe ser: bodega, tienda, almacen, deposito u otro."),

  body("capacity")
    .optional({ nullable: true })
    .isInt({ min: 1 }).withMessage("La capacidad debe ser un entero positivo."),
];

// ── Rutas ─────────────────────────────────────────────────────────
router.post("/",    createLocationRules,                        validateRequest, locationController.createLocation);
router.get("/",                                                                  locationController.getLocations);
router.get("/:id",  idParamRules,                               validateRequest, locationController.getLocationById);
router.put("/:id",  [...idParamRules, ...updateLocationRules],  validateRequest, locationController.updateLocation);
router.delete("/:id", idParamRules,                             validateRequest, locationController.deleteLocation);

export default router;
