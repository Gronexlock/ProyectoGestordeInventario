// ============================================================
// Seed Script - Datos Mock Iniciales
// Crea ubicaciones, productos y stock inicial para desarrollo
//
// Ejecución: npm run db:seed
// ============================================================

import { PrismaClient, MovementType, ReservationStatus } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Iniciando seed de base de datos...\n");

  // ── Limpiar datos existentes (orden inverso por FK) ─────────────
  await prisma.stockAlert.deleteMany();
  await prisma.replenishmentOrder.deleteMany();
  await prisma.supplier.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.dispatchSchedule.deleteMany();
  await prisma.movement.deleteMany();
  await prisma.stock.deleteMany();
  await prisma.product.deleteMany();
  await prisma.location.deleteMany();
  console.log("🧹 Datos anteriores eliminados.");

  // ── 1. Crear Ubicaciones ─────────────────────────────────────────
  const bodegaCentral = await prisma.location.create({
    data: {
      name: "Bodega Central",
      type: "bodega",
      capacity: 1000,
    },
  });

  const tiendaNorte = await prisma.location.create({
    data: {
      name: "Tienda Norte",
      type: "tienda",
      capacity: 200,
    },
  });

  console.log(`✅ Ubicaciones creadas: ${bodegaCentral.name}, ${tiendaNorte.name}`);

  // ── 2. Crear Productos ───────────────────────────────────────────
  const laptop = await prisma.product.create({
    data: {
      name: "Laptop Dell Inspiron 15",
      sku: "DELL-INS-15-001",
      minStock: 5,
    },
  });

  const mouse = await prisma.product.create({
    data: {
      name: "Mouse Inalámbrico Logitech",
      sku: "LOG-MOUSE-WL-002",
      minStock: 10, // Umbral crítico para este mouse
    },
  });

  console.log(`✅ Productos creados: ${laptop.name}, ${mouse.name}`);

  // ── 3. Crear Stock Inicial ───────────────────────────────────────
  await prisma.stock.createMany({
    data: [
      {
        productId: laptop.id,
        locationId: bodegaCentral.id,
        quantity: 50,
      },
      {
        productId: laptop.id,
        locationId: tiendaNorte.id,
        quantity: 10,
      },
      {
        productId: mouse.id,
        locationId: bodegaCentral.id,
        quantity: 150,
      },
      {
        productId: mouse.id,
        locationId: tiendaNorte.id,
        quantity: 3, // ⚠️ Por debajo del umbral crítico (≤10)
      },
    ],
  });

  console.log("✅ Stock inicial creado.");

  // ── 4. Crear Movimientos Iniciales de Referencia ─────────────────
  await prisma.movement.createMany({
    data: [
      {
        productId: laptop.id,
        locationId: bodegaCentral.id,
        type: MovementType.IN,
        quantity: 50,
        note: "Compra inicial de laptops",
      },
      {
        productId: mouse.id,
        locationId: bodegaCentral.id,
        type: MovementType.IN,
        quantity: 150,
        note: "Compra inicial de mouses",
      },
      {
        productId: laptop.id,
        locationId: tiendaNorte.id,
        type: MovementType.IN,
        quantity: 10,
        note: "Transferencia a tienda norte",
      },
      {
        productId: mouse.id,
        locationId: tiendaNorte.id,
        type: MovementType.IN,
        quantity: 3,
        note: "Transferencia de mouses a tienda norte",
      },
    ],
  });

  console.log("✅ Movimientos iniciales creados.");

  // ── 5. Crear Reservas de Prueba (mock Proyecto 3) ───────────────
  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

  await prisma.reservation.createMany({
    data: [
      {
        orderId: 1001,
        sku: laptop.sku,
        locationId: tiendaNorte.id,
        quantity: 2,
        status: ReservationStatus.ACTIVE,
        expiresAt,
      },
      {
        orderId: 1002,
        sku: mouse.sku,
        locationId: bodegaCentral.id,
        quantity: 10,
        status: ReservationStatus.ACTIVE,
        expiresAt,
      },
    ],
  });

  console.log("✅ Reservas de prueba creadas (2 ACTIVE).");

  // ── 6. Crear Proveedores ─────────────────────────────────────────
  const provA = await prisma.supplier.create({
    data: {
      name: "Distribuidora Tech S.A.",
      email: "contacto@distritech.com",
      phone: "+56 9 1234 5678",
    },
  });

  const provB = await prisma.supplier.create({
    data: {
      name: "Importadora LogiGlobal",
      email: "ventas@logiglobal.com",
      phone: "+56 2 9876 5432",
    },
  });

  console.log(`✅ Proveedores creados: ${provA.name}, ${provB.name}`);

  // ── 7. Crear Alerta de Stock Crítico Inicial ─────────────────────
  await prisma.stockAlert.create({
    data: {
      productId: mouse.id,
      locationId: tiendaNorte.id,
      currentStock: 3,
      minStock: 10,
      status: "PENDING",
    },
  });

  console.log(`✅ Alerta de stock crítico inicial generada para Mouse en Tienda Norte.`);

  // ── 8. Crear Orden de Reposición Inicial ────────────────────────
  await prisma.replenishmentOrder.create({
    data: {
      productId: mouse.id,
      locationId: tiendaNorte.id,
      supplierId: provB.id,
      quantity: 50,
      status: "PENDING",
    },
  });

  console.log(`✅ Orden de reposición inicial creada para Mouse (50 unidades).`);

  // ── Resumen ──────────────────────────────────────────────────────
  console.log("\n📊 Resumen del seed:");
  console.log(`   📍 Ubicaciones: 2`);
  console.log(`   📦 Productos:   2`);
  console.log(`   📊 Registros de stock: 4`);
  console.log(`   🔄 Movimientos: 4`);
  console.log(`   🔒 Reservas:    2 (ACTIVE)`);
  console.log(`   🏢 Proveedores: 2`);
  console.log(`   ⚠️  Alertas de Stock: 1 (PENDING)`);
  console.log(`   📋 Órdenes de Reposición: 1`);
  console.log("\n🎉 Seed completado exitosamente!\n");
}

main()
  .catch((error) => {
    console.error("❌ Error durante el seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
