# 📦 Sistema de Gestión de Inventario Distribuido

Este proyecto es un sistema de gestión de inventario para controlar stock en múltiples ubicaciones (bodegas, tiendas, etc.).

## 🏗️ Estructura del Proyecto

*   **[/backend](./backend)**: API REST desarrollada con Node.js, Express, Prisma y PostgreSQL.
*   **[/frontend](./frontend)**: Aplicación cliente (pendientes detalles de implementación).

## 🚀 Inicio Rápido (Backend)

1. Ve a la carpeta `backend`.
2. Instala dependencias: `npm install`.
3. Configura el `.env` con tu base de datos.
4. Ejecuta migraciones y seed: `npx prisma migrate dev` y `npm run db:seed`.
5. Inicia: `npm run dev`.

Para más detalles, consulta el **[README de Backend](./backend/README.md)**.