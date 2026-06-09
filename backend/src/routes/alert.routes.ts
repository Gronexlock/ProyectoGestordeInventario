import { Router } from "express";
import * as alertController from "../controllers/alert.controller";

const router = Router();

router.get("/", alertController.getAlerts);
router.patch("/:id/resolve", alertController.resolveAlert);

export default router;
