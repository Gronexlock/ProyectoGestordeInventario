// ============================================================
// app.ts - Configuración de la Aplicación Express
// Registra middlewares globales y todas las rutas de la API
// ============================================================

import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";

// Importar rutas
import locationRoutes from "./routes/location.routes";
import productRoutes from "./routes/product.routes";
import stockRoutes from "./routes/stock.routes";
import movementRoutes from "./routes/movement.routes";
import reservationRoutes from "./routes/reservation.routes";

// Importar middleware de errores (siempre al final)zr
import { errorHandler } from "./middlewares/errorHandler";

const app: express.Application = express();

// ── Middlewares Globales ────────────────────────────────────────
app.use(cors());                                    // Habilitar CORS
app.use(express.json());                            // Parsear JSON body
app.use(express.urlencoded({ extended: true }));    // Parsear form data
app.use(morgan("dev"));                             // Logging de requests

// ── Ruta de salud del servidor ──────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "🏭 API de Gestión de Inventario - v1.0.0",
    docs: {
      locations: "/api/v1/locations",
      products: "/api/v1/products",
      stock: "/api/v1/stock",
      movements: "/api/v1/movements",
    },
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Rutas de la API ─────────────────────────────────────────────
const API_PREFIX = "/api/v1";

app.use(`${API_PREFIX}/locations`, locationRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/stock`, stockRoutes);
app.use(`${API_PREFIX}/movements`, movementRoutes);
app.use(`${API_PREFIX}/reservations`, reservationRoutes);

// ── Ruta no encontrada (404) ────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: "Ruta no encontrada.",
    error: "NOT_FOUND",
  });
});

// ── Manejador global de errores (SIEMPRE al final) ──────────────
app.use(errorHandler);

export default app;
