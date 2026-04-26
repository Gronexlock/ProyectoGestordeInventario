// ============================================================
// Rutas: Products (Productos)
// POST /products    → crear producto
// GET  /products    → listar productos
// ============================================================

import { Router } from "express";
import { body } from "express-validator";
import * as productController from "../controllers/product.controller";
import { validateRequest } from "../middlewares/validateRequest";

const router = Router();

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
router.post("/", createProductRules, validateRequest, productController.createProduct);
router.get("/", productController.getProducts);

export default router;
