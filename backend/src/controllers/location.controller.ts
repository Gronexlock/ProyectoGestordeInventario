// ============================================================
// Controlador: Locations
// Delega toda la lógica al servicio; solo maneja HTTP
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as locationService from "../services/location.service";
import { sendSuccess } from "../utils/response";
import { CreateLocationDto } from "../utils/types";

/**
 * POST /locations
 * Crea una nueva ubicación
 */
export const createLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const dto: CreateLocationDto = {
      name: req.body.name,
      type: req.body.type,
      capacity: req.body.capacity,
    };

    const location = await locationService.createLocation(dto);

    sendSuccess(res, location, "Ubicación creada exitosamente.", 201);
  } catch (error) {
    next(error);
  }
};

/**
 * GET /locations
 * Lista todas las ubicaciones
 */
export const getLocations = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const locations = await locationService.getAllLocations();

    sendSuccess(res, locations, `Se encontraron ${locations.length} ubicaciones.`);
  } catch (error) {
    next(error);
  }
};
