import { Request, Response, NextFunction } from "express";
import * as alertService from "../services/alert.service";
import { sendSuccess } from "../utils/response";

export const getAlerts = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { status } = req.query;
    const alerts = await alertService.findAlerts(status as string | undefined);
    sendSuccess(res, alerts, `Se encontraron ${alerts.length} alertas.`);
  } catch (error) {
    next(error);
  }
};

export const resolveAlert = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const updated = await alertService.resolveAlertById(String(req.params.id));
    sendSuccess(res, updated, "Alerta marcada como resuelta.");
  } catch (error) {
    next(error);
  }
};
