// ============================================================
// Servicio: Products (Productos)
// Toda la lógica de negocio relacionada con productos
// ============================================================

import prisma from "../prisma/client";
import { CreateProductDto } from "../utils/types";
import { AppError } from "../utils/AppError";

/**
 * Crea un nuevo producto.
 * @throws AppError 409 si el SKU ya existe
 */
export const createProduct = async (dto: CreateProductDto) => {
  // Verificar unicidad del SKU
  const existing = await prisma.product.findUnique({
    where: { sku: dto.sku },
  });

  if (existing) {
    throw new AppError(
      `Ya existe un producto con el SKU "${dto.sku}".`,
      409
    );
  }

  const product = await prisma.product.create({
    data: {
      name: dto.name,
      sku: dto.sku,
    },
  });

  return product;
};

/**
 * Obtiene todos los productos con su stock actual en cada ubicación.
 */
export const getAllProducts = async () => {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      stocks: {
        include: {
          location: {
            select: { id: true, name: true, type: true },
          },
        },
      },
    },
  });

  return products;
};
