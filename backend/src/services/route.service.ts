// ============================================================
// Servicio: Routes (Rutas de Despacho)
//
// Lógica de negocio:
//  - Crear rutas de despacho (viaje operativo)
//  - Asignar/remover órdenes READY_FOR_DISPATCH a una ruta
//  - Despachar ruta: todas las órdenes → IN_TRANSIT en una transacción
//  - Cancelar ruta: órdenes ROUTE_ASSIGNED → READY_FOR_DISPATCH
// ============================================================

import { RouteStatus, OrderStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { AppError } from "../utils/AppError";
import {
  applyInTransitMutation,
  validateDispatchSchedule,
  validateDispatchWindow,
} from "./order.service";

const ROUTE_INCLUDE = {
  orders: {
    include: {
      items: {
        include: {
          product: { select: { id: true, name: true, sku: true } },
          location: { select: { id: true, name: true, type: true } },
        },
      },
    },
  },
};

export const createRoute = async (dto: {
  vehicleCode: string;
  driverName?: string;
}) => {
  return prisma.route.create({
    data: {
      vehicleCode: dto.vehicleCode,
      driverName: dto.driverName,
    },
    include: ROUTE_INCLUDE,
  });
};

export const getRoutes = async () => {
  return prisma.route.findMany({
    orderBy: { createdAt: "desc" },
    include: ROUTE_INCLUDE,
  });
};

export const getRouteById = async (routeId: string) => {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: ROUTE_INCLUDE,
  });

  if (!route) {
    throw new AppError(`No se encontró una ruta con ID "${routeId}".`, 404);
  }

  return route;
};

export const assignOrdersToRoute = async (
  routeId: string,
  orderIds: string[]
) => {
  const route = await prisma.route.findUnique({ where: { id: routeId } });

  if (!route) {
    throw new AppError(`No se encontró una ruta con ID "${routeId}".`, 404);
  }

  if (route.status !== RouteStatus.OPEN) {
    throw new AppError(
      `Solo se pueden asignar órdenes a rutas en estado OPEN. Estado actual: "${route.status}".`,
      400
    );
  }

  // Verificar existencia de órdenes antes de abrir la transacción (fast-fail)
  const existingOrders = await prisma.order.findMany({
    where: { id: { in: orderIds } },
    select: { id: true },
  });

  if (existingOrders.length !== orderIds.length) {
    throw new AppError("Una o más órdenes referenciadas no existen.", 404);
  }

  // La verificación de status y routeId se hace DENTRO de la transacción para evitar race conditions
  await prisma.$transaction(async (tx) => {
    for (const orderId of orderIds) {
      const order = await tx.order.findUnique({ where: { id: orderId } });

      if (!order) {
        throw new AppError(`No se encontró una orden con ID "${orderId}".`, 404);
      }

      if (order.status !== OrderStatus.READY_FOR_DISPATCH) {
        throw new AppError(
          `La orden "${orderId}" no está en estado READY_FOR_DISPATCH. Estado actual: "${order.status}".`,
          400
        );
      }

      if (order.routeId !== null) {
        throw new AppError(
          `La orden "${orderId}" ya está asignada a otra ruta activa.`,
          409
        );
      }

      await tx.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.ROUTE_ASSIGNED, routeId },
      });
    }
  });

  return getRouteById(routeId);
};

export const removeOrderFromRoute = async (
  routeId: string,
  orderId: string
) => {
  const route = await prisma.route.findUnique({ where: { id: routeId } });

  if (!route) {
    throw new AppError(`No se encontró una ruta con ID "${routeId}".`, 404);
  }

  if (route.status !== RouteStatus.OPEN) {
    throw new AppError(
      `No se puede modificar una ruta en estado "${route.status}".`,
      400
    );
  }

  const order = await prisma.order.findUnique({ where: { id: orderId } });

  if (!order) {
    throw new AppError(`No se encontró una orden con ID "${orderId}".`, 404);
  }

  if (order.routeId !== routeId) {
    throw new AppError(
      `La orden "${orderId}" no pertenece a la ruta "${routeId}".`,
      400
    );
  }

  if (order.status !== OrderStatus.ROUTE_ASSIGNED) {
    throw new AppError(
      `La orden "${orderId}" no está en estado ROUTE_ASSIGNED.`,
      400
    );
  }

  await prisma.order.update({
    where: { id: orderId },
    data: { status: OrderStatus.READY_FOR_DISPATCH, routeId: null },
  });

  return getRouteById(routeId);
};

export const dispatchRoute = async (routeId: string) => {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      orders: { include: { items: true } },
    },
  });

  if (!route) {
    throw new AppError(`No se encontró una ruta con ID "${routeId}".`, 404);
  }

  if (route.status !== RouteStatus.OPEN) {
    throw new AppError(
      `Solo se puede despachar una ruta en estado OPEN. Estado actual: "${route.status}".`,
      400
    );
  }

  const assignedOrders = route.orders.filter(
    (o) => o.status === OrderStatus.ROUTE_ASSIGNED
  );

  if (assignedOrders.length === 0) {
    throw new AppError(
      "La ruta no tiene órdenes asignadas para despachar.",
      400
    );
  }

  // Validar schedule y ventana horaria de TODAS las órdenes antes de abrir la transacción
  // Si una falla, se aborta sin haber modificado nada
  for (const order of assignedOrders) {
    await validateDispatchSchedule(order.id);
    await validateDispatchWindow(order.items.map((i) => i.locationId));
  }

  // Una sola transacción: deducción de stock + IN_TRANSIT para todas las órdenes + route DISPATCHED
  await prisma.$transaction(async (tx) => {
    for (const order of assignedOrders) {
      const items = order.items.map((i) => ({
        productId: i.productId,
        locationId: i.locationId,
        quantity: i.quantity,
      }));
      await applyInTransitMutation(tx, order.id, items);
    }

    await tx.route.update({
      where: { id: routeId },
      data: { status: RouteStatus.DISPATCHED },
    });
  });

  return getRouteById(routeId);
};

export const cancelRoute = async (routeId: string) => {
  const route = await prisma.route.findUnique({ where: { id: routeId } });

  if (!route) {
    throw new AppError(`No se encontró una ruta con ID "${routeId}".`, 404);
  }

  if (route.status !== RouteStatus.OPEN) {
    throw new AppError(
      `Solo se puede cancelar una ruta en estado OPEN. Estado actual: "${route.status}".`,
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { routeId, status: OrderStatus.ROUTE_ASSIGNED },
      data: { status: OrderStatus.READY_FOR_DISPATCH, routeId: null },
    });

    await tx.route.update({
      where: { id: routeId },
      data: { status: RouteStatus.CANCELLED },
    });
  });

  return getRouteById(routeId);
};
