# Implementation Plan: Swagger / OpenAPI Integration

## Resumen Técnico

Integrar Swagger UI en el servidor Express existente montando la ruta `/api-docs`, con la especificación OpenAPI 3.0 generada automáticamente desde anotaciones `@openapi` en los archivos de rutas. Las dependencias (`swagger-jsdoc`, `swagger-ui-express` y sus tipos) ya están instaladas. No hay cambios en Prisma ni en la lógica de negocio — es puramente documentación.

## Cambios en Prisma Schema

N/A — sin cambios de base de datos.

## Servicios Afectados

N/A — sin cambios en servicios.

## Archivos a Crear / Modificar

- `src/config/swagger.ts` (nuevo): configura `swaggerJsdoc`, define schemas base, exporta `swaggerSpec`
- `src/app.ts` (modificar): importar `swaggerUi` y `swaggerSpec`, montar `/api-docs`
- `src/routes/product.routes.ts` (modificar): agregar anotaciones `@openapi` en cada ruta
- `src/routes/location.routes.ts` (modificar): agregar anotaciones `@openapi` en cada ruta
- `src/routes/movement.routes.ts` (modificar): agregar anotaciones `@openapi`
- `src/routes/order.routes.ts` (modificar): agregar anotaciones `@openapi`

## Controllers y Rutas

Sin rutas de negocio nuevas. Solo se agrega:

- `GET /api-docs` — Swagger UI interactivo (sin auth)
- `GET /api-docs.json` — spec OpenAPI en formato JSON (lo provee swagger-ui-express automáticamente)

## Validaciones

- La ruta `/api-docs` debe registrarse **antes** del manejador 404 en `app.ts`
- El glob de escaneo en `swaggerJsdoc` debe apuntar a `src/routes/**/*.routes.ts`; en tiempo de ejecución con `ts-node-dev` las rutas están en `.ts`, pero en build producción estarían en `.js` — usar ambos: `["src/routes/**/*.routes.ts", "src/routes/**/*.routes.js"]` o resolver con `__dirname`

## Transacciones

N/A.

## Consideraciones de Concurrencia

N/A — la spec se genera una vez al iniciar el servidor y se sirve estáticamente.

## Schemas OpenAPI a definir en `swagger.ts`

Definir bajo `components.schemas` para usar con `$ref`:

**Product**
- `id` (string, uuid), `name` (string), `sku` (string), `createdAt` (string, date-time)

**Location**
- `id` (string, uuid), `name` (string), `type` (string, enum: bodega/tienda/almacen/deposito/otro), `capacity` (integer, nullable), `dispatchStart` (string), `dispatchEnd` (string), `createdAt` (string, date-time)

**Movement**
- `id` (string, uuid), `productId` (string), `locationId` (string), `type` (string, enum: IN/OUT), `quantity` (integer), `note` (string, nullable), `createdAt` (string, date-time)

**Order**
- `id` (string, uuid), `customerName` (string), `status` (string, enum: PENDING/RESERVED/READY_FOR_DISPATCH/IN_TRANSIT/DELIVERED/CANCELLED), `createdAt` (string, date-time), `updatedAt` (string, date-time), `items` (array of OrderItem)

**OrderItem**
- `id` (string, uuid), `productId` (string), `locationId` (string), `quantity` (integer)

## Orden de Implementación

1. Crear `src/config/swagger.ts` con la config de `swaggerJsdoc` y todos los schemas
2. Modificar `src/app.ts`: importar y montar `/api-docs` antes del handler 404
3. Agregar anotaciones `@openapi` en `product.routes.ts` (POST y GET)
4. Agregar anotaciones `@openapi` en `location.routes.ts` (POST, GET, GET/:id, PUT/:id, DELETE/:id)
5. Agregar anotaciones `@openapi` en `movement.routes.ts` (POST y GET)
6. Agregar anotaciones `@openapi` en `order.routes.ts` (POST, GET, GET/ready-for-dispatch, GET/:id, PATCH/:id/status)
7. Verificar que `/api-docs` renderiza correctamente con `ts-node-dev`

## Riesgos Técnicos

- **swagger-ui-express v5 cambió la API**: en v5 el import por defecto sigue funcionando (`import swaggerUi from 'swagger-ui-express'`), pero verificar que `swaggerUi.serve` y `swaggerUi.setup` estén disponibles — si no, usar `import * as swaggerUi from 'swagger-ui-express'`
- **Glob path en ts-node vs build**: `swaggerJsdoc` escanea archivos en disco; con `ts-node-dev` los `.ts` están disponibles, pero el path relativo debe ser correcto desde la raíz del proceso. Usar `path.join(process.cwd(), 'src/routes/**/*.routes.ts')` o un path relativo verificado
- **Anotaciones desincronizadas**: riesgo aceptable para uso académico; el equipo debe actualizar las anotaciones manualmente cuando cambie un endpoint
