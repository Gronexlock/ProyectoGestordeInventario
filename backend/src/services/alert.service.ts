import { AlertStatus } from "@prisma/client";
import prisma from "../prisma/client";
import { NotFoundError } from "../utils/errors";

const alertInclude = {
  product: { select: { id: true, name: true, sku: true, minStock: true } },
  location: { select: { id: true, name: true, type: true } },
} as const;

/**
 * Sincroniza alertas PENDING con el stock físico actual.
 * Usa 2 queries paralelas de lectura + operaciones en lote de escritura,
 * en lugar de N consultas individuales por cada registro de stock.
 */
export const syncCriticalAlerts = async (): Promise<void> => {
  // Lectura paralela: stocks con minStock + alertas PENDING actuales
  const [stocks, pendingAlerts] = await Promise.all([
    prisma.stock.findMany({
      select: {
        productId: true,
        locationId: true,
        quantity: true,
        product: { select: { minStock: true } },
      },
    }),
    prisma.stockAlert.findMany({
      where: { status: AlertStatus.PENDING },
      select: {
        id: true,
        productId: true,
        locationId: true,
        currentStock: true,
        minStock: true,
      },
    }),
  ]);

  // Lookup O(1) para alertas PENDING existentes
  const pendingMap = new Map(
    pendingAlerts.map((a) => [`${a.productId}:${a.locationId}`, a])
  );

  const criticalStocks = stocks.filter((s) => s.quantity <= s.product.minStock);
  const nonCriticalKeys = new Set(
    stocks
      .filter((s) => s.quantity > s.product.minStock)
      .map((s) => `${s.productId}:${s.locationId}`)
  );

  const now = new Date();
  const ops: Promise<unknown>[] = [];

  // 1. Crear en lote las alertas PENDING faltantes para stocks críticos
  const toCreate = criticalStocks.filter(
    (s) => !pendingMap.has(`${s.productId}:${s.locationId}`)
  );
  if (toCreate.length > 0) {
    ops.push(
      prisma.stockAlert.createMany({
        data: toCreate.map((s) => ({
          productId: s.productId,
          locationId: s.locationId,
          currentStock: s.quantity,
          minStock: s.product.minStock,
          status: AlertStatus.PENDING,
        })),
        skipDuplicates: true,
      })
    );
  }

  // 2. Actualizar alertas PENDING cuyo stock o umbral cambió
  for (const s of criticalStocks) {
    const existing = pendingMap.get(`${s.productId}:${s.locationId}`);
    if (
      existing &&
      (existing.currentStock !== s.quantity || existing.minStock !== s.product.minStock)
    ) {
      ops.push(
        prisma.stockAlert.update({
          where: { id: existing.id },
          data: { currentStock: s.quantity, minStock: s.product.minStock },
        })
      );
    }
  }

  // 3. Resolver en lote las alertas PENDING de stocks que ya no son críticos
  const alertsToResolve = pendingAlerts.filter((a) =>
    nonCriticalKeys.has(`${a.productId}:${a.locationId}`)
  );
  if (alertsToResolve.length > 0) {
    ops.push(
      prisma.stockAlert.updateMany({
        where: {
          status: AlertStatus.PENDING,
          OR: alertsToResolve.map((a) => ({
            productId: a.productId,
            locationId: a.locationId,
          })),
        },
        data: { status: AlertStatus.RESOLVED, resolvedAt: now },
      })
    );
  }

  if (ops.length > 0) {
    await Promise.all(ops);
  }
};

/**
 * Retorna todas las alertas de stock, opcionalmente filtradas por estado.
 * La sincronización se desacopló de la lectura: findAlerts es ahora una
 * consulta pura sin efectos secundarios. Llama a syncCriticalAlerts()
 * explícitamente desde los servicios de movimiento cuando sea necesario.
 */
export const findAlerts = async (status?: string) => {
  const where: { status?: AlertStatus } = {};
  if (status) {
    where.status = status as AlertStatus;
  }

  return prisma.stockAlert.findMany({
    where,
    include: alertInclude,
    orderBy: { createdAt: "desc" },
  });
};

/**
 * Marca una alerta como resuelta manualmente.
 * Lanza NotFoundError si la alerta no existe.
 */
export const resolveAlertById = async (id: string) => {
  const alert = await prisma.stockAlert.findUnique({ where: { id } });

  if (!alert) {
    throw new NotFoundError("Alerta", id);
  }

  return prisma.stockAlert.update({
    where: { id },
    data: {
      status: "RESOLVED",
      resolvedAt: new Date(),
    },
  });
};
