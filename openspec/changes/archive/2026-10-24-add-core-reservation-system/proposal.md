# Proposal

## Why

La institucion universitaria administra hoy la reserva de espacios academicos (laboratorios, auditorios y salas de computo) mediante correo electronico y hojas de calculo. Ese proceso manual produce duplicidad de solicitudes, conflictos de horarios, consultas de disponibilidad lentas y ausencia de trazabilidad, porque no existe una fuente unica de verdad con las reglas de integridad aplicadas de forma centralizada y automatica.

Este cambio introduce el sistema SIGREA: una aplicacion web con API REST y persistencia relacional que centraliza el ciclo de vida completo de la reserva (catalogo de espacios, solicitudes, validacion de disponibilidad, control de solapamientos, aprobacion/rechazo, cancelacion e historial), aplicando las reglas de negocio de forma transaccional y verificable.

La justificacion tecnica completa, el analisis del problema, las decisiones de arquitectura y el registro de riesgos se encuentran en `PLAN_INGENIERIA.md` (ETAPA 1), que precede a esta especificacion.

## What Changes

- Se introduce una aplicacion Node.js + TypeScript + Express con persistencia SQLite y una interfaz web ligera servida como estaticos.
- Se define el modelo de dominio: `Usuario`, `Rol`, `Permiso`, `Espacio` y `Reserva`, con la reserva en estados `PENDIENTE`, `APROBADA`, `RECHAZADA` y `CANCELADA`.
- Se implementa autenticacion local con hash bcrypt y emision de tokens JWT, con revocacion inmediata por desactivacion del usuario.
- Se implementa RBAC normalizado (roles, permisos y su matriz) con verificacion efectiva en la capa HTTP.
- Se implementa el catalogo de espacios academicos con codigo, tipo, capacidad, ubicacion y estado activo/inactivo.
- Se implementa la consulta de disponibilidad de un espacio para una fecha, devolviendo franjas ocupadas y libres.
- Se implementa la creacion de solicitudes de reserva con validacion de datos, ventana horaria del espacio, anticipacion minima y control de solapamientos dentro de una transaccion `IMMEDIATE`.
- Se implementan la aprobacion y el rechazo de solicitudes (con motivo obligatorio en el rechazo) y la cancelacion por el solicitante.
- Se implementa la bitacora de eventos (historial auditable) y la consulta del historial de una reserva.
- Se anaden pruebas unitarias de reglas de dominio y pruebas de integracion de API con base de datos aislada por prueba.
- Se anade una interfaz web operativa que consume los endpoints definidos en las especificaciones.

No hay cambios incompatibles: es la primera version funcional del sistema.

## Capabilities

### New Capabilities

- `auth`: Autenticacion de usuarios, emision y validacion de tokens JWT, y obtencion del perfil propio.
- `user-management`: Registro, consulta, actualizacion y desactivacion de usuarios del sistema.
- `rbac`: Catalogo de roles y permisos, matriz de autorizacion y verificacion efectiva de permisos en cada operacion.
- `space-management`: Catalogo y administracion de los espacios academicos (laboratorios, auditorios, salas de computo).
- `availability`: Consulta de la disponibilidad de un espacio en una fecha, con franjas ocupadas y franjas libres.
- `reservation-management`: Creacion, consulta y cancelacion de solicitudes de reserva, incluyendo la validacion de reglas de negocio y la prevencion de solapamientos.
- `reservation-approval`: Aprobacion y rechazo de solicitudes de reserva por parte de coordinadores y administradores.
- `reservation-history`: Bitacora auditable de los eventos de cada reserva y consulta del historial con filtros.

### Modified Capabilities

Ninguna. Este cambio introduce el sistema completo; no existen especificaciones previas que modificar.

## Impact

- **Codigo nuevo:** `src/` (dominio, modulos de aplicacion, adaptadores de persistencia SQLite, capa HTTP, UI estatica en `public/`), `tests/` (unitarias e integracion), `docs/TRAZABILIDAD.md`.
- **Base de datos:** esquema nuevo en `src/db/schema.sql` con las tablas `usuarios`, `roles`, `permisos`, `rol_permisos`, `espacios`, `reservas` y `eventos`; migraciones idempotentes y datos semilla.
- **API:** nueva superficie REST bajo el prefijo `/api`, con `GET /api/health` como comprobacion de disponibilidad.
- **Dependencias:** `express`, `better-sqlite3`, `zod`, `jsonwebtoken`, `bcryptjs`, `cookie-parser`, `cors`; entorno de desarrollo con `typescript`, `vitest`, `supertest`, `eslint` y `@fission-ai/openspec`.
- **Configuracion:** variables de entorno para URL de la base de datos, secreto de firma JWT, duracion del token, horario de funcionamiento de los espacios y anticipacion minima de reserva (archivo `.env.example`).
- **Sin impacto** en sistemas externos: no se integra SMTP, calendarios externos ni LDAP (declarados fuera de alcance en la v1).
- **Trazabilidad:** cada requisito de esta especificacion se vincula a un escenario de aceptacion y a una prueba automatizada en `docs/TRAZABILIDAD.md`.
