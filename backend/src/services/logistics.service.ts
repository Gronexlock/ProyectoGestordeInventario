// ============================================================
// Servicio: Logistics Simulation
//
// Simula el comportamiento de Proyecto 2 (Logística):
//  - Vista de rutas despachadas con progreso de entrega
//  - Confirmación de entrega por orden individual
//  - Completado masivo de una ruta
// ============================================================

import { RouteStatus, OrderStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { AppError } from "../utils/AppError";

const LOGISTICS_ORDER_SELECT = {
  id: true,
  customerName: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const LOGISTICS_ORDER_DETAIL_INCLUDE = {
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      location: { select: { id: true, name: true, type: true } },
    },
  },
};

function computeProgress(orders: { status: string }[]) {
  return {
    total: orders.length,
    delivered: orders.filter((o) => o.status === OrderStatus.DELIVERED).length,
    inTransit: orders.filter((o) => o.status === OrderStatus.IN_TRANSIT).length,
  };
}

export const getLogisticsRoutes = async () => {
  const routes = await prisma.route.findMany({
    where: { status: { in: [RouteStatus.DISPATCHED, RouteStatus.COMPLETED] } },
    orderBy: { createdAt: "desc" },
    include: {
      orders: { select: LOGISTICS_ORDER_SELECT },
    },
  });

  return routes.map((route) => ({
    ...route,
    progress: computeProgress(route.orders),
  }));
};

export const getLogisticsRouteById = async (routeId: string) => {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      orders: {
        include: LOGISTICS_ORDER_DETAIL_INCLUDE,
      },
    },
  });

  if (!route) {
    throw new AppError(`No se encontró una ruta con ID "${routeId}".`, 404);
  }

  return {
    ...route,
    progress: computeProgress(route.orders),
  };
};

export const confirmOrderDelivery = async (
  routeId: string,
  orderId: string
) => {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: { orders: { select: { id: true, status: true, routeId: true } } },
  });

  if (!route) {
    throw new AppError(`No se encontró una ruta con ID "${routeId}".`, 404);
  }

  if (route.status !== RouteStatus.DISPATCHED) {
    throw new AppError(
      `Solo se puede confirmar entrega en rutas con estado DISPATCHED. Estado actual: "${route.status}".`,
      400
    );
  }

  const order = route.orders.find((o) => o.id === orderId);

  if (!order) {
    throw new AppError(
      `La orden "${orderId}" no pertenece a la ruta "${routeId}".`,
      404
    );
  }

  if (order.status !== OrderStatus.IN_TRANSIT) {
    throw new AppError(
      `La orden "${orderId}" no está en estado IN_TRANSIT. Estado actual: "${order.status}".`,
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.DELIVERED },
    });

    const remaining = await tx.order.count({
      where: { routeId, status: OrderStatus.IN_TRANSIT },
    });

    // Si no quedan órdenes en tránsito, la ruta se completa.
    // updateMany con where status=DISPATCHED es idempotente ante requests concurrentes.
    if (remaining === 0) {
      await tx.route.updateMany({
        where: { id: routeId, status: RouteStatus.DISPATCHED },
        data: { status: RouteStatus.COMPLETED },
      });
    }
  });

  return getLogisticsRouteById(routeId);
};

export const completeRoute = async (routeId: string) => {
  const route = await prisma.route.findUnique({
    where: { id: routeId },
    include: {
      orders: {
        where: { status: OrderStatus.IN_TRANSIT },
        select: { id: true },
      },
    },
  });

  if (!route) {
    throw new AppError(`No se encontró una ruta con ID "${routeId}".`, 404);
  }

  if (route.status !== RouteStatus.DISPATCHED) {
    throw new AppError(
      `Solo se puede completar una ruta en estado DISPATCHED. Estado actual: "${route.status}".`,
      400
    );
  }

  if (route.orders.length === 0) {
    throw new AppError(
      "La ruta no tiene órdenes IN_TRANSIT para completar.",
      400
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.order.updateMany({
      where: { routeId, status: OrderStatus.IN_TRANSIT },
      data: { status: OrderStatus.DELIVERED },
    });

    await tx.route.update({
      where: { id: routeId },
      data: { status: RouteStatus.COMPLETED },
    });
  });

  return getLogisticsRouteById(routeId);
};
