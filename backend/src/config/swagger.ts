// ============================================================
// Configuración de Swagger / OpenAPI 3.0
// Genera la especificación a partir de anotaciones @openapi
// en los archivos de rutas
// ============================================================

import swaggerJsdoc from "swagger-jsdoc";
import path from "path";

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "API de Gestión de Inventario",
      version: "1.0.0",
      description:
        "API REST del Sistema de Gestión de Inventario Distribuido. " +
        "Maneja stock, movimientos, reservas, transferencias y pedidos en múltiples ubicaciones.",
    },
    servers: [
      {
        url: "http://localhost:3000/api/v1",
        description: "Servidor de desarrollo",
      },
    ],
    components: {
      schemas: {
        // ── Producto ───────────────────────────────────────────
        Product: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid", example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890" },
            name: { type: "string", example: "Tornillo M8" },
            sku: { type: "string", example: "TRN-M8-001" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Ubicación ─────────────────────────────────────────
        Location: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            name: { type: "string", example: "Bodega Central" },
            type: {
              type: "string",
              enum: ["bodega", "tienda", "almacen", "deposito", "otro"],
              example: "bodega",
            },
            capacity: { type: "integer", nullable: true, example: 1000 },
            dispatchStart: { type: "string", example: "8:00" },
            dispatchEnd: { type: "string", example: "18:00" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Movimiento ────────────────────────────────────────
        Movement: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            productId: { type: "string", format: "uuid" },
            locationId: { type: "string", format: "uuid" },
            type: { type: "string", enum: ["IN", "OUT"], example: "IN" },
            quantity: { type: "integer", example: 50 },
            note: { type: "string", nullable: true, example: "Reposición semanal" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        // ── Ítem de Pedido ────────────────────────────────────
        OrderItem: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            productId: { type: "string", format: "uuid" },
            locationId: { type: "string", format: "uuid" },
            quantity: { type: "integer", example: 3 },
          },
        },
        // ── Pedido ────────────────────────────────────────────
        Order: {
          type: "object",
          properties: {
            id: { type: "string", format: "uuid" },
            customerName: { type: "string", example: "Juan Pérez" },
            status: {
              type: "string",
              enum: [
                "PENDING",
                "RESERVED",
                "READY_FOR_DISPATCH",
                "IN_TRANSIT",
                "DELIVERED",
                "CANCELLED",
              ],
              example: "PENDING",
            },
            createdAt: { type: "string", format: "date-time" },
            updatedAt: { type: "string", format: "date-time" },
            items: {
              type: "array",
              items: { $ref: "#/components/schemas/OrderItem" },
            },
          },
        },
        // ── Respuestas estándar ───────────────────────────────
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Descripción del error." },
            error: { type: "string", example: "ERROR_CODE" },
          },
        },
      },
    },
  },
  // Escanea los archivos de rutas para extraer las anotaciones @openapi
  apis: [
    path.join(process.cwd(), "src/routes/**/*.routes.ts"),
    path.join(process.cwd(), "src/routes/**/*.routes.js"),
  ],
};

export const swaggerSpec = swaggerJsdoc(options);
