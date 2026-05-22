import { Router } from "express";
import * as reservationController from "../controllers/reservation.controller";

const router: Router = Router();

// ── Rutas de Reservas ────────────────────────────────────────────────────────
router.post("/", (req, res, next) => reservationController.createTemporaryReservation(req, res, next));

export default router;
