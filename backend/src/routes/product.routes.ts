// ============================================================
// Rutas: Products (Productos)
// POST /products    → crear producto
// GET  /products    → listar productos
// ============================================================

import { Router } from "express";
import { body } from "express-validator";
import * as productController from "../controllers/product.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router: Router = Router();

/**
 * Reglas de validación para crear un producto
 */
const createProductRules = [
  body("name")
    .trim()
    .notEmpty().withMessage("El nombre del producto es requerido.")
    .isLength({ min: 2, max: 150 }).withMessage("El nombre debe tener entre 2 y 150 caracteres."),

  body("sku")
    .trim()
    .notEmpty().withMessage("El SKU es requerido.")
    .isLength({ min: 3, max: 50 }).withMessage("El SKU debe tener entre 3 y 50 caracteres.")
    .matches(/^[A-Z0-9\-_]+$/i).withMessage("El SKU solo puede contener letras, números, guiones y guiones bajos."),
];

// ── Rutas ─────────────────────────────────────────────────────────

/**
 * @openapi
 * /products:
 *   post:
 *     tags: [Products]
 *     summary: Crear un producto
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, sku]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 2
 *                 maxLength: 150
 *                 example: Tornillo M8
 *               sku:
 *                 type: string
 *                 minLength: 3
 *                 maxLength: 50
 *                 example: TRN-M8-001
 *     responses:
 *       201:
 *         description: Producto creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Product'
 *       400:
 *         description: Datos de entrada inválidos
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: SKU duplicado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     tags: [Products]
 *     summary: Listar todos los productos
 *     responses:
 *       200:
 *         description: Lista de productos
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 */
router.post("/", createProductRules, validateRequest, productController.createProduct);
router.get("/", productController.getProducts);

export default router;
