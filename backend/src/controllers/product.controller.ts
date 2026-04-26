// ============================================================
// Controlador: Products
// Delega toda la lógica al servicio; solo maneja HTTP
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as productService from "../services/product.service";
import { sendSuccess } from "../utils/response";
import { CreateProductDto } from "../utils/types";

/**
 * POST /products
 * Crea un nuevo producto
 */
export const createProduct = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dto: CreateProductDto = {
      name: req.body.name,
      sku: req.body.sku,
    };

    const product = await productService.createProduct(dto);

    sendSuccess(res, product, "Producto creado exitosamente.", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /products
 * Lista todos los productos con su stock por ubicación
 */
export const getProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const products = await productService.getAllProducts();

    sendSuccess(res, products, `Se encontraron ${products.length} productos.`);
  } catch (error) {
    next(error);
  }
};
