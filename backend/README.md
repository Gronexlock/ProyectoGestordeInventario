# 🏭 Sistema de Gestión de Inventario (Backend)

Este es el backend del sistema de gestión de inventario distribuido, desarrollado con **Node.js**, **Express**, **TypeScript** y **Prisma ORM**.

## 🚀 Requisitos Previos

*   [Node.js](https://nodejs.org/) (v18 o superior recomendado)
*   [PostgreSQL](https://www.postgresql.org/) (Instalado y corriendo)

## 🛠️ Instalación y Configuración

Sigue estos pasos para configurar el proyecto en tu entorno local:

### 1. Clonar e Instalar dependencias
Desde la carpeta `backend`, ejecuta:
```bash
npm install
```

### 2. Configurar variables de entorno
Crea un archivo `.env` en la raíz de la carpeta `backend` (puedes copiar el contenido de `.env.example`) y configura tu cadena de conexión a PostgreSQL:

```env
DATABASE_URL="postgresql://USUARIO:PASSWORD@localhost:5432/GestorInventario?schema=public"
PORT=3000
NODE_ENV=development
```

### 3. Preparar la Base de Datos
Ejecuta las migraciones de Prisma para crear las tablas y luego carga los datos de prueba (seed):

```bash
# Crear tablas en la base de datos
npx prisma migrate dev --name init

# Cargar datos mock (ubicaciones, productos y stock inicial)
npm run db:seed
```

## 🏃 Ejecución

Para iniciar el servidor en modo desarrollo con recarga automática:
```bash
npm run dev
```

El servidor estará disponible en: `http://localhost:3000`

## 🔌 Endpoints de la API (v1)

### 📍 Ubicaciones (`/api/v1/locations`)
*   `GET /` - Listar todas las ubicaciones y su stock.
*   `POST /` - Crear una nueva ubicación.

### 📦 Productos (`/api/v1/products`)
*   `GET /` - Listar todos los productos y su stock global.
*   `POST /` - Crear un nuevo producto (SKU único).

### 📊 Stock (`/api/v1/stock`)
*   `GET /` - Ver el inventario completo.
*   `GET /:locationId` - Ver el inventario de una ubicación específica.

### 🔄 Movimientos (`/api/v1/movements`)
*   `GET /` - Historial de todos los movimientos.
*   `POST /` - Registrar entrada (IN) o salida (OUT). *Valida stock negativo y genera alertas críticas.*

## 🧪 Reglas de Negocio Implementadas
*   **No stock negativo**: El sistema impide registros de salida que dejen el stock por debajo de cero.
*   **Alertas Críticas**: Se emite un `console.warn` y una alerta en el JSON cuando el stock de un producto baja de 5 unidades.
*   **Transacciones Atómicas**: Los movimientos y la actualización de stock ocurren en una sola operación para asegurar la integridad de los datos.

## 📁 Estructura del Proyecto
*   `src/services/`: Lógica de negocio pura.
*   `src/controllers/`: Manejo de peticiones y respuestas HTTP.
*   `src/routes/`: Definición de rutas y validaciones de entrada.
*   `src/middlewares/`: Manejo global de errores y validación.
*   `src/prisma/`: Schema de base de datos y scripts de seed.
