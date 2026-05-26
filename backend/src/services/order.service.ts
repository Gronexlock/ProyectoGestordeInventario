// ============================================================
// Servicio: Orders (Pedidos de Salida)
//
// Lógica de negocio:
//  - Crear pedidos con ítems (producto + ubicación + cantidad)
//  - Máquina de estados: PENDING → RESERVED → READY_FOR_DISPATCH
//                         → IN_TRANSIT → DELIVERED | CANCELLED
//  - Reservas y descuentos de stock via helpers de StockService
// ============================================================

import { OrderStatus, Prisma } from "@prisma/client";
import prisma from "../prisma/client";
import { AppError } from "../utils/AppError";
import { reserveStock, releaseStock, deductStock } from "./stock.service";
import { CreateOrderDto } from "../utils/types";
import { config } from "../config/config";

// Transiciones de estado permitidas
// ROUTE_ASSIGNED es gestionado exclusivamente por el servicio de rutas (no expuesto en PATCH /orders/:id/status)
const VALID_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["RESERVED", "CANCELLED"],
  RESERVED: ["READY_FOR_DISPATCH", "CANCELLED"],
  READY_FOR_DISPATCH: ["IN_TRANSIT", "CANCELLED"],
  ROUTE_ASSIGNED: [],
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

  // Validaciones previas a IN_TRANSIT (fuera de la transacción para fallar rápido)
  if (newStatus === "IN_TRANSIT") {
    await validateDispatchSchedule(orderId);
    await validateDispatchWindow(order.items.map((i) => i.locationId));
  }

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

// Valida y normaliza "H:mm" o "HH:mm" → "HH:mm". Lanza AppError si el formato es inválido.
const normalizeTime = (time: string): string => {
  if (!/^\d{1,2}:\d{2}$/.test(time)) {
    throw new AppError(
      `Formato de horario inválido: "${time}". Use H:mm o HH:mm (ej: "8:00" o "08:00").`,
      400
    );
  }
  const [hoursStr, minutesStr] = time.split(":");
  const hours = parseInt(hoursStr, 10);
  const minutes = parseInt(minutesStr, 10);
  if (hours > 23 || minutes > 59) {
    throw new AppError(
      `Horario fuera de rango: "${time}". Horas: 0–23, minutos: 0–59.`,
      400
    );
  }
  return `${String(hours).padStart(2, "0")}:${minutesStr}`;
};

// Convierte un string normalizado "HH:mm" a minutos desde medianoche.
const parseTimeToMinutes = (time: string): number => {
  const normalized = normalizeTime(time);
  const [hours, minutes] = normalized.split(":").map(Number);
  return hours * 60 + minutes;
};

// Retorna los minutos actuales desde medianoche en la timezone configurada.
const getCurrentMinutesInTimezone = (timezone: string): number => {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());

  const hours = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10) % 24;
  const minutes = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  return hours * 60 + minutes;
};

/**
 * Valida que exista un DispatchSchedule no cancelado con scheduleDate = hoy.
 * @throws AppError 400 si no existe o está cancelado
 */
export const validateDispatchSchedule = async (orderId: string): Promise<void> => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const schedule = await prisma.dispatchSchedule.findFirst({
    where: {
      orderId,
      status: { not: "CANCELLED" },
      scheduleDate: { gte: todayStart, lte: todayEnd },
    },
  });

  if (!schedule) {
    throw new AppError(
      "El pedido no tiene un DispatchSchedule válido para hoy. Asigne uno antes de despachar.",
      400
    );
  }
};

/**
 * Valida que la hora actual (en config.appTimezone) esté dentro de la ventana de despacho
 * de todas las ubicaciones origen del pedido.
 * @throws AppError 400 si alguna ubicación está fuera de su ventana horaria
 */
export const validateDispatchWindow = async (locationIds: string[]): Promise<void> => {
  const uniqueLocationIds = [...new Set(locationIds)];

  const locations = await prisma.location.findMany({
    where: { id: { in: uniqueLocationIds } },
    select: { id: true, name: true, dispatchStart: true, dispatchEnd: true },
  });

  const currentMinutes = getCurrentMinutesInTimezone(config.appTimezone);
  const currentHH = String(Math.floor(currentMinutes / 60)).padStart(2, "0");
  const currentMM = String(currentMinutes % 60).padStart(2, "0");
  const currentTimeStr = `${currentHH}:${currentMM}`;

  for (const location of locations) {
    const startNormalized = normalizeTime(location.dispatchStart);
    const endNormalized = normalizeTime(location.dispatchEnd);
    const startMinutes = parseTimeToMinutes(startNormalized);
    const endMinutes = parseTimeToMinutes(endNormalized);

    if (currentMinutes < startMinutes || currentMinutes > endMinutes) {
      throw new AppError(
        `La ubicación "${location.name}" solo permite despachos entre ${startNormalized} y ${endNormalized}. ` +
          `Hora actual (${config.appTimezone}): ${currentTimeStr}.`,
        400
      );
    }
  }
};

/**
 * Aplica la mutación IN_TRANSIT para una orden dentro de una transacción externa.
 * Usado por route.service para despachar múltiples órdenes en una sola transacción.
 * routeId se preserva en la orden como referencia histórica de qué ruta la despachó.
 */
export const applyInTransitMutation = async (
  tx: Prisma.TransactionClient,
  orderId: string,
  items: { productId: string; locationId: string; quantity: number }[]
): Promise<void> => {
  await deductStock(tx, items, orderId);
  await tx.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.IN_TRANSIT },
  });
};

/**
 * Crea un DispatchSchedule para un pedido en estado READY_FOR_DISPATCH.
 * Impide duplicados activos para el mismo pedido en la misma fecha.
 * @throws AppError 404 si el pedido no existe
 * @throws AppError 400 si el pedido no está en READY_FOR_DISPATCH o la fecha es pasada
 * @throws AppError 409 si ya existe un schedule activo para esa fecha
 */
export const createDispatchSchedule = async (
  orderId: string,
  dto: { scheduleDate: string; priority?: string }
) => {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) {
    throw new AppError(`No se encontró un pedido con ID "${orderId}".`, 404);
  }
  if (order.status !== "READY_FOR_DISPATCH") {
    throw new AppError(
      `Solo se puede agendar despacho para pedidos en estado READY_FOR_DISPATCH. Estado actual: "${order.status}".`,
      400
    );
  }

  const scheduleDate = new Date(dto.scheduleDate);
  if (isNaN(scheduleDate.getTime())) {
    throw new AppError("La fecha de despacho no es válida.", 400);
  }

  const dayStart = new Date(scheduleDate);
  dayStart.setUTCHours(0, 0, 0, 0);
  const dayEnd = new Date(scheduleDate);
  dayEnd.setUTCHours(23, 59, 59, 999);

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  if (dayStart < today) {
    throw new AppError("La fecha de despacho no puede ser anterior a hoy.", 400);
  }

  const existing = await prisma.dispatchSchedule.findFirst({
    where: {
      orderId,
      status: { not: "CANCELLED" },
      scheduleDate: { gte: dayStart, lte: dayEnd },
    },
  });
  if (existing) {
    throw new AppError(
      `Ya existe un DispatchSchedule activo para el pedido en la fecha ${dto.scheduleDate}.`,
      409
    );
  }

  return prisma.dispatchSchedule.create({
    data: {
      orderId,
      scheduleDate: dayStart,
      startTime: "00:00",
      endTime: "23:59",
      status: "SCHEDULED",
      priority: dto.priority ?? "NORMAL",
    },
  });
};
