// ============================================================
// Servicio: Movements (Movimientos de Inventario)
// 
// Lógica de negocio crítica:
//  - Validar existencia de producto y ubicación
//  - Crear stock automáticamente si no existe
//  - Impedir stock negativo en salidas (OUT)
//  - Actualizar stock con transacción atómica
//  - Emitir alerta si stock ≤ umbral crítico
// ============================================================

import prisma from "../prisma/client";
import { CreateMovementDto, MovementResult } from "../utils/types";
import { AppError } from "../utils/AppError";
import { config } from "../config/config";

/**
 * Registra un movimiento de inventario (entrada o salida) y
 * actualiza el stock correspondiente de forma atómica.
 *
 * @throws AppError 404 si el producto o la ubicación no existen
 * @throws AppError 400 si el movimiento genera stock negativo
 */
export const createMovement = async (
  dto: CreateMovementDto
): Promise<MovementResult> => {
  // ── 1. Validar que existen producto y ubicación ───────────────
  const [product, location] = await Promise.all([
    prisma.product.findUnique({ where: { id: dto.productId } }),
    prisma.location.findUnique({ where: { id: dto.locationId } }),
  ]);

  if (!product) {
    throw new AppError(
      `No se encontró un producto con ID "${dto.productId}".`,
      404
    );
  }

  if (!location) {
    throw new AppError(
      `No se encontró una ubicación con ID "${dto.locationId}".`,
      404
    );
  }

  // ── 2. Validar cantidad positiva ──────────────────────────────
  if (dto.quantity <= 0) {
    throw new AppError(
      "La cantidad del movimiento debe ser mayor a cero.",
      400
    );
  }

  // ── 3. Validar horario de despacho (reservas/salidas) ─────────
  if (dto.type === "OUT") {
    const now = new Date();
    const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTime = (timeStr: string) => {
      const parts = timeStr.split(':');
      const h = parseInt(parts[0], 10) || 0;
      const m = parseInt(parts[1], 10) || 0;
      return h * 60 + m;
    };

    const startMinutes = parseTime(location.dispatchStart);
    const endMinutes = parseTime(location.dispatchEnd);

    if (currentTotalMinutes < startMinutes || currentTotalMinutes > endMinutes) {
      throw new AppError(
        `Operación rechazada: La ubicación "${location.name}" está fuera de su horario de despacho (Horario: ${location.dispatchStart} a ${location.dispatchEnd}).`,
        400
      );
    }
  }

  // ── 4. Transacción atómica ────────────────────────────────────
  // Todo o nada: si algo falla, se hace rollback automáticamente
  const result = await prisma.$transaction(async (tx) => {
    // 3a. Buscar stock existente para producto+ubicación
    const existingStock = await tx.stock.findUnique({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.locationId,
        },
      },
    });

    // 3b. Calcular nueva cantidad según tipo de movimiento
    const currentQuantity = existingStock?.quantity ?? 0;
    let newQuantity: number;

    if (dto.type === "IN") {
      newQuantity = currentQuantity + dto.quantity;
    } else {
      // OUT: verificar que no quede negativo
      newQuantity = currentQuantity - dto.quantity;

      if (newQuantity < 0) {
        throw new AppError(
          `Stock insuficiente. Stock actual: ${currentQuantity} unidades. ` +
          `Se intentaron retirar: ${dto.quantity} unidades.`,
          400
        );
      }
    }

    // 3c. Crear o actualizar el stock (upsert)
    const updatedStock = await tx.stock.upsert({
      where: {
        productId_locationId: {
          productId: dto.productId,
          locationId: dto.locationId,
        },
      },
      create: {
        productId: dto.productId,
        locationId: dto.locationId,
        quantity: newQuantity,
      },
      update: {
        quantity: newQuantity,
      },
    });

    // 3d. Registrar el movimiento
    const movement = await tx.movement.create({
      data: {
        productId: dto.productId,
        locationId: dto.locationId,
        type: dto.type,
        quantity: dto.quantity,
        note: dto.note,
      },
    });

    return { movement, updatedStock, newQuantity };
  });

  // ── 4. Alerta de stock crítico ────────────────────────────────
  let alert: string | undefined;

  if (result.newQuantity <= config.criticalStockThreshold) {
    alert =
      `⚠️ STOCK CRÍTICO: "${product.name}" (SKU: ${product.sku}) ` +
      `en "${location.name}" tiene solo ${result.newQuantity} unidades.`;

    // Alerta visible en los logs del servidor
    console.warn(`\n⚠️  ALERTA DE STOCK CRÍTICO`);
    console.warn(`   Producto:  ${product.name} (${product.sku})`);
    console.warn(`   Ubicación: ${location.name}`);
    console.warn(`   Stock:     ${result.newQuantity} unidades (umbral: ≤${config.criticalStockThreshold})\n`);
  }

  return {
    movement: result.movement,
    updatedStock: result.updatedStock,
    alert,
  };
};

/**
 * Obtiene el historial de movimientos con detalles de producto y ubicación.
 */
export const getAllMovements = async () => {
  return prisma.movement.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      product: { select: { id: true, name: true, sku: true } },
      location: { select: { id: true, name: true, type: true } },
    },
  });
};
