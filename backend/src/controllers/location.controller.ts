// ============================================================
// Controlador: Locations
// Delega toda la lógica al servicio; solo maneja HTTP
// ============================================================

import { Request, Response, NextFunction } from "express";
import * as locationService from "../services/location.service";
import { sendSuccess } from "../utils/response";
import { CreateLocationDto, UpdateLocationDto } from "../utils/types";

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

/**
 * GET /locations/:id
 * Retorna una ubicación específica con su stock
 */
export const getLocationById = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const location = await locationService.getLocationById(id);

    sendSuccess(res, location, `Ubicación "${location.name}" encontrada.`);
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /locations/:id
 * Actualiza los datos de una ubicación existente
 */
export const updateLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const dto: UpdateLocationDto = {
      name: req.body.name,
      type: req.body.type,
      capacity: req.body.capacity,
    };

    const updated = await locationService.updateLocation(id, dto);

    sendSuccess(res, updated, `Ubicación "${updated.name}" actualizada exitosamente.`);
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /locations/:id
 * Elimina una ubicación (solo si no tiene stock asociado)
 */
export const deleteLocation = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const id = req.params.id as string;
    const deleted = await locationService.deleteLocation(id);

    sendSuccess(res, deleted, `Ubicación "${deleted.name}" eliminada exitosamente.`);
  } catch (error) {
    next(error);
  }
};
