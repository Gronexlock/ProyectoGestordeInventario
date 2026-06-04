# CLAUDE.md

# Sistema de Gestión de Inventario Distribuido

## Contexto General

Este proyecto corresponde al backend de un sistema de gestión de inventario distribuido.

El sistema maneja:

* stock en múltiples ubicaciones
* movimientos de inventario
* reservas
* transferencias entre bodegas
* devoluciones
* alertas de stock crítico
* reposiciones automáticas
* integraciones con sistemas externos

El backend está construido con:

* Node.js
* Express
* TypeScript
* Prisma ORM
* PostgreSQL

## Filosofía del Proyecto

Este proyecto prioriza:

* simplicidad
* mantenibilidad
* claridad arquitectónica
* desarrollo incremental
* lógica de negocio explícita
* consistencia de inventario

Evitar:

* sobreingeniería
* arquitecturas enterprise innecesarias
* abstracciones prematuras
* patrones complejos sin necesidad
* generación excesiva de archivos
* capas innecesarias

La prioridad es:

1. funcionalidad correcta
2. integridad de inventario
3. mantenibilidad
4. simplicidad

## Arquitectura Actual

Estructura principal del backend:

* src/controllers
* src/services
* src/routes
* src/middlewares
* src/prisma

Mantener consistencia con esta estructura.

## Reglas de Desarrollo

### Servicios

Preferir:

* services pequeños y claros
* lógica de negocio explícita
* funciones simples y entendibles

Evitar:

* lógica compleja en controllers
* lógica distribuida innecesariamente
* abstracciones genéricas exageradas

### Controllers

Los controllers deben:

* recibir requests
* validar entrada
* llamar servicios
* retornar respuestas

No deben contener lógica de negocio compleja.

### Prisma

Preferir:

* queries simples
* transacciones explícitas
* relaciones claras
* validaciones antes de escribir datos

Evitar:

* queries excesivamente complejas
* nested operations innecesarias
* abstracciones sobre Prisma sin necesidad

## Reglas Críticas de Inventario

### Stock

* nunca permitir stock negativo
* validar disponibilidad antes de descontar
* movimientos deben ser atómicos
* transferencias deben ejecutarse en una sola transacción
* reservas no pueden exceder stock disponible

### Concurrencia

Considerar siempre:

* race conditions
* concurrencia en reservas
* doble confirmación
* actualizaciones simultáneas

Cuando una operación modifique stock:

* usar transacciones Prisma
* validar integridad antes de confirmar cambios

## Reservas

Las reservas deben:

* separar stock reservado de stock disponible
* poder expirar automáticamente
* poder liberarse manualmente
* poder convertirse en movimientos OUT

Stock disponible:
stockDisponible = quantity - reservado

## Eventos e Integraciones

El sistema se integrará con:

* Proyecto 2 (Logística)
* Proyecto 3 (Pedidos)

Eventos importantes:

* stock_reserved
* stock_released
* stock_depleted
* stock_transferred
* replenishment_created

Preferir eventos:

* simples
* desacoplados
* fáciles de consumir

NO implementar arquitecturas complejas de eventos sin necesidad.

## APIs Externas

El sistema tendrá endpoints externos para:

* consulta de stock
* reservas externas
* liberación de reservas

Considerar:

* seguridad
* validación
* rate limiting
* idempotencia cuando aplique

## Alertas y Reposición

El sistema manejará:

* stock crítico por producto
* órdenes automáticas de reposición
* notificaciones al equipo de compras

Mantener esta lógica simple y desacoplada.

## Testing

Priorizar tests para:

* movimientos
* reservas
* transferencias
* validaciones de stock negativo
* concurrencia
* transacciones críticas

No generar tests gigantes innecesarios.

## Estilo de Código

Preferir:

* código explícito
* nombres claros
* funciones pequeñas
* validaciones visibles
* lógica fácil de seguir

Evitar:

* magia innecesaria
* abstracciones difíciles de entender
* patrones avanzados sin beneficio real

## Implementación de Features

Cuando implementes una nueva feature:

1. primero entender el requerimiento
2. detectar ambigüedades
3. hacer preguntas cortas y relevantes
4. resumir el plan brevemente
5. implementar incrementalmente

Si un requerimiento es ambiguo:

* detenerse
* preguntar primero
* no asumir arquitectura compleja automáticamente

## Reglas Importantes para Claude

NO introducir automáticamente:

* CQRS
* Event Sourcing
* DDD complejo
* Kafka
* factories innecesarias
* repositories abstractos genéricos
* microservicios innecesarios
* patterns enterprise exagerados

Preferir:

* Express simple
* Prisma directo
* services claros
* transacciones explícitas
* código mantenible
* soluciones pragmáticas

## Objetivo General

El objetivo NO es construir una arquitectura enterprise compleja.

El objetivo es construir un backend:

* sólido
* consistente
* entendible
* mantenible
* incremental
* fácil de desarrollar en equipo
