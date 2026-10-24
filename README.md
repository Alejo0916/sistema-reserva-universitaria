# SIGREA — Sistema de Gestión de Reservas de Espacios Académicos

Aplicación web que centraliza la reserva de espacios académicos (laboratorios, auditorios, salas de cómputo y salas de reunión) de una institución universitaria, sustituyendo el proceso manual basado en correo electrónico y hojas de cálculo.

El sistema aplica las reglas de integridad **de forma centralizada y transaccional**: dos solicitudes simultáneas sobre la misma franja horaria producen **una sola reserva activa**, no dos.

Desarrollado con **Spec-Driven Development (SDD) sobre OpenSpec**, siguiendo el proceso de planificación → especificación → revisión → implementación → gestión de cambios documentado en [`PLAN_INGENIERIA.md`](PLAN_INGENIERIA.md).

---

## Índice

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Instalación](#instalación)
- [Configuración](#configuración)
- [Ejecución](#ejecución)
- [Usuarios y datos de ejemplo](#usuarios-y-datos-de-ejemplo)
- [Pruebas y verificación](#pruebas-y-verificación)
- [API](#api)
- [Modelo de datos](#modelo-de-datos)
- [Reglas de negocio](#reglas-de-negocio)
- [Estructura del repositorio](#estructura-del-repositorio)
- [Proceso de desarrollo (SDD + OpenSpec)](#proceso-de-desarrollo-sdd--openspec)
- [Licencia y contexto académico](#licencia-y-contexto-académico)

---

## Características

| Capacidad | Descripción |
|---|---|
| **Autenticación** | Registro público (rol fijo `ESTUDIANTE`), inicio de sesión con hash bcrypt, token JWT con versión revocable, cierre de sesión y límite de intentos fallidos (5 en 15 minutos → `429`). |
| **Usuarios** | Alta, consulta con filtros y paginación, actualización de datos y rol, desactivación (soft delete que preserva el historial) y restablecimiento de contraseña. |
| **Roles y permisos** | RBAC normalizado (`ADMIN`, `COORDINADOR`, `DOCENTE`, `ESTUDIANTE`) con 10 permisos granulares. El permiso se resuelve desde la base de datos **en cada petición**, de modo que un cambio de rol surte efecto inmediato. |
| **Espacios académicos** | Catálogo con código, nombre, tipo, capacidad, ubicación, horario propio y estado activo/inactivo. Un espacio con reservas activas no puede desactivarse. |
| **Disponibilidad** | Consulta de franjas ocupadas (con estado y solicitante) y franjas libres de un espacio en una fecha, restando las reservas activas de la franja de funcionamiento. |
| **Reservas** | Creación con validación completa, consulta con alcance según el rol, cancelación y control de solapamientos transaccional. |
| **Aprobación y rechazo** | Cola de solicitudes pendientes, aprobación, rechazo con motivo obligatorio y separación de funciones (el solicitante no puede resolver su propia solicitud). |
| **Historial y auditoría** | Bitácora *append-only* de todos los eventos de dominio, con consulta por reserva y consulta global con filtros. |
| **Interfaz web** | SPA sin framework ni paso de build: catálogo, disponibilidad, solicitud de reserva, gestión de reservas, cola de aprobaciones y auditoría. |

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Lenguaje / runtime | TypeScript 5 · Node.js ≥ 20 (ESM) |
| Framework HTTP | Express 5 |
| Persistencia | SQLite 3 vía `better-sqlite3` (SQL parametrizado, sin ORM) |
| Validación | Zod 4 |
| Autenticación | JWT (`jsonwebtoken`) + bcrypt (`bcryptjs`, sin compilación nativa) |
| Pruebas | Vitest 3 + Supertest 7 |
| Especificación | OpenSpec 1.15 (schema `spec-driven`) |
| Interfaz | HTML + CSS + JS nativo, sin build |
| Calidad | TypeScript en modo estricto + ESLint 9 |

Las decisiones de arquitectura y las alternativas descartadas están justificadas en [`PLAN_INGENIERIA.md` §3](PLAN_INGENIERIA.md) y en [`design.md`](openspec/changes/add-core-reservation-system/design.md).

---

## Requisitos previos

- **Node.js 20 o superior** (probado con Node 24). Verificar con `node --version`.
- **npm 10 o superior** (viene con Node).
- No se requiere servidor de base de datos: SQLite es embebido.

---

## Instalación

```bash
# 1. Instalar dependencias de forma reproducible (usa el lockfile)
npm ci

# 2. Crear el archivo de configuracion local
cp .env.example .env      # Windows PowerShell: copy-item .env.example .env
```

En Windows, si PowerShell bloquea los scripts de npm por la política de ejecución, invoque el ejecutable directamente:

```powershell
& "C:\Program Files\nodejs\npm.cmd" ci
```

---

## Configuración

Todas las variables están documentadas en [`.env.example`](.env.example).

| Variable | Por defecto | Descripción |
|---|---|---|
| `PUERTO` | `3000` | Puerto del servidor HTTP. |
| `HOST` | `0.0.0.0` | Interfaz de escucha. |
| `DATABASE_URL` | `./data/sigrea.db` | Ruta del archivo SQLite (`:memory:` para una base efímera). |
| `JWT_SECRET` | — | **Obligatoria.** Mínimo 16 caracteres (32 en producción). |
| `JWT_EXPIRES_IN` | `2h` | Duración del token de sesión. |
| `ESPACIO_HORARIO_APERTURA` | `08:00` | Horario inicial aplicado a los espacios nuevos. |
| `ESPACIO_HORARIO_CIERRE` | `22:00` | Horario de cierre inicial aplicado a los espacios nuevos. |
| `ANTICIPACION_MINIMA_HORAS` | `2` | Anticipación mínima para solicitar una reserva. |
| `DURACION_MINIMA_MINUTOS` | `15` | Duración mínima de una reserva. |
| `CORS_ORIGIN` | `http://localhost:3000` | Origen permitido para CORS. |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error`. |

> **Antes de cualquier uso real**, cambie `JWT_SECRET` por un valor aleatorio de al menos 32 caracteres y cambie las contraseñas de los usuarios de ejemplo.

---

## Ejecución

### Puesta en marcha completa

```bash
npm run db:migrate     # Crea el esquema (idempotente)
npm run db:seed        # Carga roles, permisos, usuarios y espacios de ejemplo
npm run dev            # Servidor de desarrollo con recarga automatica
```

Abrir <http://localhost:3000> en el navegador.

### Modo producción

```bash
npm run build          # Compila TypeScript a dist/ y copia los assets
npm start              # Ejecuta el servidor compilado
```

### Otros comandos

| Comando | Descripción |
|---|---|
| `npm test` | Ejecuta la suite completa de pruebas. |
| `npm run test:watch` | Modo interactivo de pruebas. |
| `npm run test:coverage` | Pruebas con informe de cobertura y umbrales. |
| `npm run typecheck` | Comprobación de tipos en modo estricto. |
| `npm run lint` | ESLint sobre todo el proyecto. |
| `npm run verify` | `typecheck` + `lint` + `test` + validación de OpenSpec. |
| `npm run db:reset` | Elimina la base de datos (hay que volver a migrar y sembrar). |
| `npm run db:backup` | Copia de seguridad del archivo SQLite en `backups/`. |
| `npm run openspec:validate` | Valida las especificaciones en modo estricto. |
| `npm run openspec:list` | Lista las especificaciones y cambios vigentes. |

---

## Usuarios y datos de ejemplo

El sembrado crea cuatro usuarios de demostración y seis espacios académicos.

| Usuario | Contraseña | Rol |
|---|---|---|
| `admin@uni.edu` | `admin1234` | `ADMIN` |
| `coordinador@uni.edu` | `coord1234` | `COORDINADOR` |
| `docente@uni.edu` | `docen1234` | `DOCENTE` |
| `estudiante@uni.edu` | `estud1234` | `ESTUDIANTE` |

Espacios: `LAB-101`, `LAB-205`, `AUD-MAIN`, `SALA-COMP-3`, `SALA-REF-12`, `SEM-04`.

El registro público de la interfaz web crea usuarios con rol `ESTUDIANTE`. Para crear un usuario con otro rol, use el `POST /api/usuarios` con un token de `ADMIN`.

---

## Pruebas y verificación

```bash
npm run verify
```

Estado actual de la suite:

| Métrica | Valor |
|---|---|
| Pruebas automatizadas | **191** (unitarias + de integración) |
| Cobertura de líneas | **93,2 %** |
| Cobertura de ramas | **81,4 %** |
| Cobertura de funciones | **97,1 %** |
| Duración de la suite | ≈ 2,5 s |

Cada archivo de prueba usa **su propia base de datos en memoria** y **su propio reloj de negocio**, de modo que las pruebas son aisladas, ejecutables en cualquier orden e independientes de la zona horaria de la máquina.

La correspondencia entre cada requisito de la especificación, su escenario de aceptación, la prueba que lo verifica y el archivo de implementación está en [`docs/TRAZABILIDAD.md`](docs/TRAZABILIDAD.md).

---

## API

Base: `/api`. Todas las rutas autenticadas requieren la cabecera `Authorization: Bearer <token>`.

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/registro` | Registro público (rol fijo `ESTUDIANTE`). |
| `POST` | `/api/auth/login` | Inicio de sesión; devuelve `token` y `usuario`. |
| `GET` | `/api/auth/perfil` | Perfil del usuario autenticado. |
| `POST` | `/api/auth/logout` | Cierre de sesión (invalida los tokens emitidos). |

### Usuarios, roles y permisos

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/api/usuarios` | `usuarios:leer` |
| `GET` | `/api/usuarios/:id` | `usuarios:leer` |
| `POST` | `/api/usuarios` | `usuarios:escribir` |
| `PATCH` | `/api/usuarios/:id` | `usuarios:escribir` |
| `POST` | `/api/usuarios/:id/desactivar` | `usuarios:escribir` |
| `POST` | `/api/usuarios/:id/contrasena` | `usuarios:escribir` |
| `GET` | `/api/roles` | autenticado |
| `GET` | `/api/permisos` | autenticado |

### Espacios y disponibilidad

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/api/espacios` | `espacios:leer` |
| `GET` | `/api/espacios/:referencia` | `espacios:leer` |
| `POST` | `/api/espacios` | `espacios:escribir` |
| `PATCH` | `/api/espacios/:referencia` | `espacios:escribir` |
| `POST` | `/api/espacios/:referencia/activar` | `espacios:escribir` |
| `POST` | `/api/espacios/:referencia/desactivar` | `espacios:escribir` |
| `GET` | `/api/espacios/:referencia/disponibilidad?fecha=YYYY-MM-DD` | `espacios:leer` |

`:referencia` admite el identificador numérico **o** el código alfanumérico (`LAB-101`).

### Reservas

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/api/reservas` | `reservas:leer` |
| `GET` | `/api/reservas/pendientes` | `reservas:aprobar` |
| `GET` | `/api/reservas/:id` | `reservas:leer` |
| `POST` | `/api/reservas` | `reservas:crear` |
| `POST` | `/api/reservas/:id/cancelar` | `reservas:cancelar` |
| `POST` | `/api/reservas/:id/aprobar` | `reservas:aprobar` |
| `POST` | `/api/reservas/:id/rechazar` | `reservas:aprobar` |

Filtros de `GET /api/reservas`: `espacioId`, `usuarioId`, `estado`, `fecha`, `pagina`, `limite`.

### Historial y auditoría

| Método | Ruta | Permiso |
|---|---|---|
| `GET` | `/api/reservas/:id/historial` | `reservas:leer` |
| `GET` | `/api/eventos` | `auditoria:leer` |

Filtros de `GET /api/eventos`: `tipo`, `entidadTipo`, `entidadId`, `desde`, `hasta`, `pagina`, `limite`.

### Salud

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servicio y de la base de datos. |

### Formato de respuesta

**Colección** (todas las listas):

```json
{ "datos": [ /* ... */ ], "total": 42, "pagina": 1, "limite": 20 }
```

**Error** (todos los errores):

```json
{
  "error": {
    "codigo": "ESPACIO_OCUPADO",
    "mensaje": "El espacio ya tiene una reserva activa en esa franja",
    "detalles": [{ "campo": "horaInicio", "mensaje": "La franja 10:00 a 12:00 ya esta reservada (PENDIENTE)" }]
  }
}
```

| Código | HTTP |
|---|---|
| `VALIDACION` | 422 |
| `NO_AUTENTICADO` · `CREDENCIALES_INVALIDAS` | 401 |
| `DEMASIADOS_INTENTOS` | 429 |
| `PERMISO_DENEGADO` · `AUTO_APROBACION_PROHIBIDA` | 403 |
| `RESERVA_NO_ENCONTRADA` · `ESPACIO_NO_ENCONTRADO` · `USUARIO_NO_ENCONTRADO` | 404 |
| `EMAIL_DUPLICADO` · `CODIGO_ESPACIO_DUPLICADO` | 409 |
| `ESPACIO_OCUPADO` · `ESTADO_INVALIDO` · `ESPACIO_INACTIVO` · `ESPACIO_CON_RESERVAS_ACTIVAS` · `AUTOMODIFICACION_PROHIBIDA` | 409 |
| `ANTICIPACION_INSUFICIENTE` · `FUERA_DE_HORARIO` · `CAPACIDAD_EXCEDIDA` · `ROL_NO_PERMITIDO` · `ROL_DESCONOCIDO` · `TIPO_ESPACIO_DESCONOCIDO` | 422 |

### Ejemplo con `curl`

```bash
# 1. Iniciar sesión
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"docente@uni.edu","contrasena":"docen1234"}' | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

# 2. Consultar la disponibilidad de un espacio
curl -s "http://localhost:3000/api/espacios/LAB-101/disponibilidad?fecha=2026-04-01" \
  -H "Authorization: Bearer $TOKEN"

# 3. Crear una solicitud de reserva
curl -s -X POST http://localhost:3000/api/reservas \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"espacioId":1,"fecha":"2026-04-01","horaInicio":"10:00","horaFin":"12:00","justificacion":"Practica de laboratorio"}'
```

---

## Modelo de datos

```
usuarios ──┬──< roles >──< rol_permisos >──< permisos
           │
           └──< reservas >── espacios
                       │
                       └──< eventos   (bitácora append-only)
```

| Tabla | Contenido |
|---|---|
| `usuarios` | Personas registradas. `email` único, hash de contraseña, `token_version` para revocación. |
| `roles` / `permisos` / `rol_permisos` | RBAC normalizado (4 roles, 10 permisos). |
| `espacios` | Catálogo de espacios. `codigo` único, tipo restringido por `CHECK`, horario propio. |
| `reservas` | Reservas y su estado. FK `ON DELETE RESTRICT` para preservar el historial. |
| `eventos` | Bitácora *append-only* con tipo, actor, entidad y detalle en JSON. |

Restricciones declarativas en el motor: `CHECK (hora_inicio < hora_fin)`, `CHECK (capacidad > 0)`, `CHECK (tipo IN (...))`, `CHECK (estado IN (...))`, `UNIQUE` en correo y código, `PRAGMA foreign_keys = ON`, índices compuestos para las consultas de disponibilidad, filtro por solicitante y auditoría.

---

## Reglas de negocio

1. **Exclusión mutua de franjas.** Dos reservas activas (en estado `PENDIENTE` o `APROBADA`) no pueden solaparse en el mismo espacio y fecha. Las franjas se interpretan como intervalos semiabiertos `[inicio, fin)`: dos franjas que solo se tocan en un extremo **no** se consideran solapadas. La verificación y la inserción se ejecutan dentro de una misma transacción `BEGIN IMMEDIATE`, lo que garantiza la exclusión incluso bajo peticiones concurrentes.
2. **Franja dentro del horario del espacio.** La reserva debe caber íntegramente entre la apertura y el cierre del espacio (horario propio de cada espacio).
3. **Anticipación mínima.** La reserva debe comenzar con al menos `ANTICIPACION_MINIMA_HORAS` de margen respecto al momento de la solicitud.
4. **Duración mínima.** La reserva debe durar al menos `DURACION_MINIMA_MINUTOS`.
5. **Capacidad.** Si se indica el número de asistentes, no puede superar la capacidad del espacio.
6. **Una fecha civil.** Una reserva no cruza medianoche.
7. **Estados.** `PENDIENTE → APROBADA | RECHAZADA | CANCELADA` y `APROBADA → CANCELADA`. Los estados terminales no admiten transición (respuesta `409 ESTADO_INVALIDO`).
8. **Separación de funciones.** Quien crea una solicitud no puede aprobarla ni rechazarla (`403 AUTO_APROBACION_PROHIBIDA`).
9. **Visibilidad.** `DOCENTE` y `ESTUDIANTE` solo ven sus propias reservas; `COORDINADOR` y `ADMIN` ven todas.
10. **Revocación inmediata.** Desactivar un usuario, cambiarle la contraseña o cerrar sesión invalida al instante todos sus tokens.

> La **regla de las cuatro horas consecutivas** solicitada por la institución se incorpora en la Fase 4 del proceso SDD mediante un *change* de OpenSpec. Consulte [`openspec/changes/`](openspec/changes) y el capítulo correspondiente de [`INFORME_FINAL.md`](INFORME_FINAL.md).

---

## Estructura del repositorio

```
.
├── PLAN_INGENIERIA.md          ETAPA 1 — planificación de ingeniería (commit independiente)
├── INFORME_FINAL.md            Análisis de resultados, dificultades y conclusiones
├── README.md                   Este documento
├── docs/
│   ├── REVISION_SPECS.md       Revisión formal de las especificaciones (Fase 2)
│   └── TRAZABILIDAD.md         Matriz requisito → escenario → prueba → implementación
├── openspec/
│   ├── config.yaml             Configuración de OpenSpec (artefactos en español)
│   ├── specs/                  Especificación vigente por capacidad
│   └── changes/                Cambios en curso y archivo histórico
├── src/
│   ├── domain/                 Reglas puras: tiempo, solapamiento, estados, errores
│   ├── shared/                 Configuración, reloj de negocio, bus de eventos, paginación
│   ├── db/                     Esquema, conexión, migraciones, semilla y repositorios
│   ├── modules/                Un módulo por capacidad: domain + application
│   ├── http/                   Middlewares, rutas y manejador de errores
│   ├── container.ts            Punto único de composición de dependencias
│   ├── app.ts                  Construcción de la aplicación Express
│   └── server.ts               Arranque del proceso
├── public/                     Interfaz web (HTML + CSS + JS nativo)
├── tests/
│   ├── unit/                   Pruebas de las reglas puras y de la infraestructura
│   ├── integration/            Pruebas de la API HTTP con base de datos aislada
│   └── helpers/                Entorno de prueba y utilidades de sesión
└── scripts/                    Utilidades de construcción
```

### Arquitectura

Monolito modular en cuatro capas con dependencias dirigidas en un solo sentido:

```
HTTP (adaptador de entrada)  ->  casos de uso (application)  ->  dominio (reglas puras)
                                        ^
                                        |
                              puertos (interfaces)
                                        ^
                                        |
                        SQLite (adaptadores de infraestructura)
```

El dominio no depende de nada: es TypeScript puro y se prueba sin base de datos.

---

## Proceso de desarrollo (SDD + OpenSpec)

El historial de Git documenta la secuencia exigida por la cátedra:

| Commit | Fase | Contenido |
|---|---|---|
| `docs(plan): plan de ingenieria de software (ETAPA 1)` | ETAPA 1 | `PLAN_INGENIERIA.md` en un commit **independiente**. |
| `chore(setup): configuracion base del proyecto e inicializacion de OpenSpec` | ETAPA 2 · Fase 1 | Herramientas y configuración. Sin código funcional. |
| `spec(specs): FASE 1 - especificaciones de las 8 capacidades` | ETAPA 2 · Fase 1 | Propuesta y especificaciones delta de las 8 capacidades. |
| `spec(review): FASE 2 - revision de especificaciones, diseno tecnico y tareas` | ETAPA 2 · Fase 2 | Revisión con 11 hallazgos corregidos, `design.md` y `tasks.md`. |
| `feat(core)`, `feat(ui)`, `test(...)` | ETAPA 2 · Fase 3 | Implementación progresiva y pruebas por capacidad. |
| `spec(change): regla de 4 horas consecutivas` | ETAPA 2 · Fase 4 | *Change* de OpenSpec para la nueva regla de negocio. |
| `feat(reservations)` + `test` | ETAPA 2 · Fase 4 | Implementación del cambio y pruebas nuevas. |
| `docs(final): ...` | ETAPA 2 · Fase 5 | Cierre, verificación y documentación final. |

### Comandos de OpenSpec

```bash
npx openspec list --specs        # Listar la especificación vigente
npx openspec show <capacidad>    # Ver una capacidad
npx openspec validate --strict   # Validar especificaciones y cambios
npx openspec archive <change>    # Archivar un cambio ya implementado
```

---

## Licencia y contexto académico

Proyecto académico desarrollado como práctica de **Spec-Driven Development con OpenSpec** en el marco de la asignatura de Planificación de Ingeniería de Software.

El código, las especificaciones y la documentación de este repositorio tienen fines **académicos y evaluativos**. Los datos de ejemplo (usuarios, espacios y credenciales) son ficticios y no deben utilizarse en un entorno real.
