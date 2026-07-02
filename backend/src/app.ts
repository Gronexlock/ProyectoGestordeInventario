// ============================================================
// app.ts - Configuración de la Aplicación Express
// ============================================================

import express, { Application, Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import { swaggerSpec } from "./config/swagger";
import { logger } from "./config/logger";

// Rutas
import locationRoutes from "./routes/location.routes";
import productRoutes from "./routes/product.routes";
import stockRoutes from "./routes/stock.routes";
import movementRoutes from "./routes/movement.routes";
import reservationRoutes, { releaseReservationRouter } from "./routes/reservation.routes";
import externalRoutes from "./routes/external.routes";
import orderRoutes from "./routes/order.routes";
import routeRoutes from "./routes/route.routes";
import logisticsRoutes from "./routes/logistics.routes";
import alertRoutes from "./routes/alert.routes";
import replenishmentRoutes from "./routes/replenishment.routes";
import syncRoutes from "./routes/sync.routes";
import pickingRoutes from "./routes/picking.routes";
import reportRoutes from "./routes/report.routes";
import eventRoutes from "./routes/event.routes";

import { errorHandler } from "./middlewares/errorHandler";

const app: Application = express();

// ── Seguridad ────────────────────────────────────────────────
app.use(helmet());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Demasiadas solicitudes. Intenta en 15 minutos." },
});
app.use("/api", limiter);

// ── Middlewares Globales ─────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL ?? "http://localhost:5173,http://localhost:80")
  .split(",")
  .map((o) => o.trim());

app.use(cors({
  origin: (origin, callback) => {
    // Permite peticiones sin Origin (Postman, curl, servicios server-to-server)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origen no permitido: ${origin}`));
    }
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Api-Key", "Authorization"],
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  morgan("combined", {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: () => process.env.NODE_ENV === "test",
  })
);

// ── Rutas de salud ───────────────────────────────────────────
app.get("/", (_req: Request, res: Response) => {
  res.json({
    success: true,
    message: "🏭 API de Gestión de Inventario - v1.0.0",
    docs: "/api-docs",
    timestamp: new Date().toISOString(),
  });
});

app.get("/health", (_req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Rutas de la API ──────────────────────────────────────────
const API_PREFIX = "/api/v1";

app.use(`${API_PREFIX}/locations`, locationRoutes);
app.use(`${API_PREFIX}/products`, productRoutes);
app.use(`${API_PREFIX}/stock`, stockRoutes);
app.use(`${API_PREFIX}/movements`, movementRoutes);
app.use(`${API_PREFIX}/reservations`, reservationRoutes);
app.use(`${API_PREFIX}/release-reservation`, releaseReservationRouter);
app.use(`${API_PREFIX}/external`, externalRoutes);
app.use(`${API_PREFIX}/orders`, orderRoutes);
app.use(`${API_PREFIX}/routes`, routeRoutes);
app.use(`${API_PREFIX}/logistics`, logisticsRoutes);
app.use(`${API_PREFIX}/alerts`, alertRoutes);
app.use(`${API_PREFIX}/replenishment`, replenishmentRoutes);
app.use(`${API_PREFIX}/sync`, syncRoutes);
app.use(`${API_PREFIX}/picking`, pickingRoutes);
app.use(`${API_PREFIX}/reports`, reportRoutes);
app.use(`${API_PREFIX}/events`, eventRoutes);

// ── Documentación Swagger ────────────────────────────────────
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ── 404 ──────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Ruta no encontrada.", error: "NOT_FOUND" });
});

// ── Error Handler (siempre al final) ────────────────────────
app.use(errorHandler);

export default app;
