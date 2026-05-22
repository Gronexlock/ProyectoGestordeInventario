# Swagger / OpenAPI Integration

> Exponer documentación interactiva de la API REST del sistema de inventario en `/api-docs`, para uso académico y testing interno.

## Functional Requirements

- Montar Swagger UI en `GET /api-docs` usando `swagger-ui-express`
- Generar la especificación OpenAPI 3.0 desde anotaciones JSDoc en los archivos de rutas usando `swagger-jsdoc`
- Incluir schemas reutilizables para: `Product`, `Location`, `Movement`, `Order`
- Documentar endpoints gradualmente — empezar con `products` y `locations`, luego el resto
- Configuración centralizada en `src/config/swagger.ts`

## Business Rules

- La ruta `/api-docs` no requiere autenticación (uso interno/académico)
- Las anotaciones JSDoc deben vivir en los archivos `src/routes/*.routes.ts` (cerca de la definición de la ruta)
- Los schemas se definen una sola vez en la config central y se referencian con `$ref`

## Technical Decisions

- `swagger-jsdoc` escanea los archivos `src/routes/**/*.routes.ts` para extraer anotaciones `@openapi`
- La config Swagger se inicializa una vez en `src/config/swagger.ts` y se importa en `app.ts`
- Versión OpenAPI: 3.0.0 — compatible con swagger-jsdoc v6 y swagger-ui-express v5
- No se usa `swagger-autogen` ni generación automática desde Prisma — las anotaciones son manuales para mantener control

## Architectural Impact

- Modelos afectados: ninguno (solo documentación)
- Archivos nuevos: `src/config/swagger.ts`
- Archivos modificados: `src/app.ts` (montar la ruta `/api-docs`), archivos de rutas seleccionados
- Dependencias externas: ya instaladas (`swagger-jsdoc`, `swagger-ui-express`, sus tipos)

## Risks & Considerations

- Las anotaciones JSDoc pueden quedar desincronizadas con la implementación real — riesgo bajo en uso académico
- swagger-ui-express v5 tiene una API levemente distinta a v4 (importación por defecto vs named exports) — verificar compatibilidad al montar

## Initial Scope (v1)

Crear `src/config/swagger.ts` con la config base y schemas de `Product`, `Location`, `Movement` y `Order`. Montar `/api-docs` en `app.ts`. Documentar los endpoints de `products` y `locations` como ejemplo de referencia. El resto de los módulos se documenta de forma incremental sin cambios estructurales adicionales.
