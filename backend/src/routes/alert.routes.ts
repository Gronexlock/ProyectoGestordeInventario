import { Router } from "express";
import * as alertController from "../controllers/alert.controller";

const router: ReturnType<typeof Router> = Router();

router.get("/", alertController.getAlerts);
router.patch("/:id/resolve", alertController.resolveAlert);

export default router;
