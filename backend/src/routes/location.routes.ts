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

const router = Router();

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

/**
 * @openapi
 * /locations:
 *   post:
 *     tags: [Locations]
 *     summary: Crear una ubicación
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:
 *                 type: string
 *                 example: Bodega Central
 *               type:
 *                 type: string
 *                 enum: [bodega, tienda, almacen, deposito, otro]
 *               capacity:
 *                 type: integer
 *                 example: 500
 *     responses:
 *       201:
 *         description: Ubicación creada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       400:
 *         description: Datos inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Locations]
 *     summary: Listar todas las ubicaciones
 *     responses:
 *       200:
 *         description: Lista de ubicaciones
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
 *                     $ref: '#/components/schemas/Location'
 *
 * /locations/{id}:
 *   get:
 *     tags: [Locations]
 *     summary: Obtener una ubicación por ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ubicación encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       404:
 *         description: Ubicación no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     tags: [Locations]
 *     summary: Actualizar una ubicación
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [bodega, tienda, almacen, deposito, otro]
 *               capacity:
 *                 type: integer
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Ubicación actualizada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Location'
 *       404:
 *         description: Ubicación no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     tags: [Locations]
 *     summary: Eliminar una ubicación
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Ubicación eliminada
 *       404:
 *         description: Ubicación no encontrada
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post("/",    createLocationRules,                        validateRequest, locationController.createLocation);
router.get("/",                                                                  locationController.getLocations);
router.get("/:id",  idParamRules,                               validateRequest, locationController.getLocationById);
router.put("/:id",  [...idParamRules, ...updateLocationRules],  validateRequest, locationController.updateLocation);
router.delete("/:id", idParamRules,                             validateRequest, locationController.deleteLocation);

export default router;
