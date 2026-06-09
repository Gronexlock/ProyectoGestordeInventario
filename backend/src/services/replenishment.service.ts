import { ReplenishmentStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { NotFoundError, ConflictError } from "../utils/errors";

// ── Proveedores ────────────────────────────────────────────────────────────────

export const findSuppliers = async () =>
  prisma.supplier.findMany({ orderBy: { name: "asc" } });

export const createSupplierRecord = async (data: {
  name: string;
  email: string;
  phone?: string;
}) => prisma.supplier.create({ data });

// ── Órdenes de Reposición ──────────────────────────────────────────────────────

export const findReplenishmentOrders = async () =>
  prisma.replenishmentOrder.findMany({
    include: {
      product: { select: { id: true, name: true, sku: true } },
      location: { select: { id: true, name: true, type: true } },
      supplier: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
  });

export const createOrder = async (dto: {
  productId: string;
  locationId: string;
  supplierId: string;
  quantity: number;
}) => {
  const [product, location, supplier] = await Promise.all([
    prisma.product.findUnique({ where: { id: dto.productId } }),
    prisma.location.findUnique({ where: { id: dto.locationId } }),
    prisma.supplier.findUnique({ where: { id: dto.supplierId } }),
  ]);

  if (!product) throw new NotFoundError("Producto", dto.productId);
  if (!location) throw new NotFoundError("Ubicación", dto.locationId);
  if (!supplier) throw new NotFoundError("Proveedor", dto.supplierId);

  return prisma.replenishmentOrder.create({
    data: { ...dto, status: "ORDERED" },
    include: {
      product: { select: { name: true, sku: true } },
      location: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });
};

export const updateOrderStatus = async (id: string, status: string) => {
  const order = await prisma.replenishmentOrder.findUnique({
    where: { id },
    include: { product: true, location: true },
  });

  if (!order) throw new NotFoundError("Orden de reposición", id);

  if (order.status === "RECEIVED" || order.status === "CANCELLED") {
    throw new ConflictError(
      `No se puede cambiar el estado de una orden en estado final: ${order.status}`
    );
  }

  if (status === "RECEIVED") {
    return prisma.$transaction(async (tx) => {
      const stock = await tx.stock.upsert({
        where: { productId_locationId: { productId: order.productId, locationId: order.locationId } },
        create: { productId: order.productId, locationId: order.locationId, quantity: order.quantity },
        update: { quantity: { increment: order.quantity } },
      });

      await tx.movement.create({
        data: {
          productId: order.productId,
          locationId: order.locationId,
          type: "IN",
          quantity: order.quantity,
          note: `Ingreso automático por orden de reposición ${id.slice(0, 8)}`,
        },
      });

      const updatedOrder = await tx.replenishmentOrder.update({
        where: { id },
        data: { status: "RECEIVED" },
        include: {
          product: { select: { name: true, sku: true, minStock: true } },
          location: { select: { name: true } },
          supplier: { select: { name: true } },
        },
      });

      if (stock.quantity > order.product.minStock) {
        await tx.stockAlert.updateMany({
          where: { productId: order.productId, locationId: order.locationId, status: "PENDING" },
          data: { status: "RESOLVED", resolvedAt: new Date() },
        });
      }

      return updatedOrder;
    });
  }

  return prisma.replenishmentOrder.update({
    where: { id },
    data: { status: status as ReplenishmentStatus },
    include: {
      product: { select: { name: true, sku: true } },
      location: { select: { name: true } },
      supplier: { select: { name: true } },
    },
  });
};
