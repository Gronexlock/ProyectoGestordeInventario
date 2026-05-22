// ============================================================
// Servicio: Orders (Pedidos de Salida)
//
// Lógica de negocio:
//  - Crear pedidos con ítems (producto + ubicación + cantidad)
//  - Máquina de estados: PENDING → RESERVED → READY_FOR_DISPATCH
//                         → IN_TRANSIT → DELIVERED | CANCELLED
//  - Reservas y descuentos de stock via helpers de StockService
// ============================================================

import { OrderStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { AppError } from "../utils/AppError";
import { reserveStock, releaseStock, deductStock } from "./stock.service";
import { CreateOrderDto } from "../utils/types";

// Transiciones de estado permitidas
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["RESERVED", "CANCELLED"],
  RESERVED: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["IN_TRANSIT", "CANCELLED"],
  IN_TRANSIT: ["DELIVERED"],
  DELIVERED: [],
  CANCELLED: [],
};

// Include reutilizable para respuestas con detalle de ítems
const ORDER_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      location: { select: { id: true, name: true, type: true } },
    },
  },
};

/**
 * Crea un pedido en estado PENDING con sus ítems.
 * Valida que productos y ubicaciones existan antes de persistir.
 */
export const createOrder = async (dto: CreateOrderDto) => {
  // Validar existencia de productos y ubicaciones referenciados
  const productIds = [...new Set(dto.items.map((i) => i.productId))];
  const locationIds = [...new Set(dto.items.map((i) => i.locationId))];

  const [products, locations] = await Promise.all([
    prisma.product.findMany({ where: { id: { in: productIds } } }),
    prisma.location.findMany({ where: { id: { in: locationIds } } }),
  ]);

  if (products.length !== productIds.length) {
    throw new AppError("Uno o más productos referenciados no existen.", 404);
  }

  if (locations.length !== locationIds.length) {
    throw new AppError("Una o más ubicaciones referenciadas no existen.", 404);
  }

  const order = await prisma.order.create({
    data: {
      customerName: dto.customerName,
      items: {
        create: dto.items.map((item) => ({
          productId: item.productId,
          locationId: item.locationId,
          quantity: item.quantity,
        })),
      },
    },
    include: ORDER_INCLUDE,
  });

  return order;
};

/**
 * Retorna pedidos en estado READY_FOR_DISPATCH con filtros opcionales.
 * Valida existencia de locationId y coherencia del rango de fechas antes de consultar.
 */
export const getReadyForDispatch = async (filters: {
  locationId?: string;
  dateFrom?: string;
  dateTo?: string;
}) => {
  const { locationId, dateFrom, dateTo } = filters;

  if (locationId) {
    const location = await prisma.location.findUnique({ where: { id: locationId } });
    if (!location) {
      throw new AppError(`No se encontró una ubicación con ID "${locationId}".`, 404);
    }
  }

  if (dateFrom && dateTo && new Date(dateFrom) > new Date(dateTo)) {
    throw new AppError("El parámetro dateFrom no puede ser posterior a dateTo.", 400);
  }

  let createdAtFilter: { gte?: Date; lte?: Date } | undefined;
  if (dateFrom || dateTo) {
    createdAtFilter = {};
    if (dateFrom) createdAtFilter.gte = new Date(dateFrom);
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setUTCHours(23, 59, 59, 999);
      createdAtFilter.lte = toDate;
    }
  }

  return prisma.order.findMany({
    where: {
      status: OrderStatus.READY_FOR_DISPATCH,
      ...(locationId && { items: { some: { locationId } } }),
      ...(createdAtFilter && { createdAt: createdAtFilter }),
    },
    orderBy: { createdAt: "desc" },
    include: ORDER_INCLUDE,
  });
};

/**
 * Retorna todos los pedidos con sus ítems.
 */
export const getAllOrders = async () => {
  return prisma.order.findMany({
    orderBy: { createdAt: "desc" },
    include: ORDER_INCLUDE,
  });
};

/**
 * Retorna un pedido por ID con detalle completo de ítems.
 * @throws AppError 404 si el pedido no existe
 */
export const getOrderById = async (orderId: string) => {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: ORDER_INCLUDE,
  });

  if (!order) {
    throw new AppError(`No se encontró un pedido con ID "${orderId}".`, 404);
  }

  return order;
};

/**
 * Transiciona el estado de un pedido según la máquina de estados.
 * Ejecuta los efectos sobre stock dentro de una transacción atómica.
 *
 * Efectos por transición:
 *  PENDING → RESERVED:          reserva stock (todo o nada)
 *  RESERVED → READY_FOR_DISPATCH: sin cambio en stock
 *  READY_FOR_DISPATCH → IN_TRANSIT: convierte reservas en movimientos OUT
 *  → CANCELLED (desde RESERVED o READY_FOR_DISPATCH): libera reservas
 *  → DELIVERED: sin cambio en stock
 *
 * @throws AppError 404 si el pedido no existe
 * @throws AppError 400 si la transición no está permitida
 */
export const transitionOrder = async (
  orderId: string,
  newStatus: string
): Promise<ReturnType<typeof getOrderById>> => {
  // Obtener pedido con ítems
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    throw new AppError(`No se encontró un pedido con ID "${orderId}".`, 404);
  }

  // Validar que la transición sea permitida
  const validNext = VALID_TRANSITIONS[order.status] ?? [];

  if (!validNext.includes(newStatus)) {
    throw new AppError(
      `Transición no permitida: "${order.status}" → "${newStatus}". ` +
        `Estados válidos desde "${order.status}": ${validNext.length ? validNext.join(", ") : "ninguno"}.`,
      400
    );
  }

  const stockItems = order.items.map((item) => ({
    productId: item.productId,
    locationId: item.locationId,
    quantity: item.quantity,
  }));

  // Ejecutar efectos de stock + actualización de estado en una transacción
  await prisma.$transaction(async (tx) => {
    if (newStatus === "RESERVED") {
      await reserveStock(tx, stockItems);
    } else if (newStatus === "IN_TRANSIT") {
      await deductStock(tx, stockItems, orderId);
    } else if (
      newStatus === "CANCELLED" &&
      (order.status === "RESERVED" || order.status === "READY_FOR_DISPATCH")
    ) {
      await releaseStock(tx, stockItems);
    }

    await tx.order.update({
      where: { id: orderId },
      data: { status: newStatus as OrderStatus },
    });
  });

  return getOrderById(orderId);
};
