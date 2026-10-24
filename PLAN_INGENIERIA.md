# Plan de Ingeniería de Software
## Sistema de Gestión de Reservas de Espacios Académicos

| Campo | Valor |
|---|---|
| **Proyecto** | Sistema de Gestión de Reservas de Espacios Académicos (SIGREA) |
| **Modalidad** | Individual |
| **Metodología** | Spec-Driven Development (SDD) con OpenSpec, asistido por un agente de IA de programación |
| **Etapa** | ETAPA 1 — Planificación de ingeniería (previo a la especificación y a la implementación) |
| **Versión del documento** | 1.0 |
| **Autor** | Estudiante responsable del proyecto |

---

## 0. Propósito del documento

Este documento responde **antes de escribir una sola línea de código** a las preguntas que la institución y la cátedra están evaluando:

1. ¿Qué problema se resuelve y hasta dónde llega la solución?
2. ¿Con qué arquitectura y stack se implementará, y **por qué se descartaron las alternativas**?
3. ¿En qué etapas se divide el trabajo y cómo se sabe que cada una terminó?
4. ¿Cómo se garantiza la calidad y qué riesgos se anticiparon?
5. ¿Cómo se usará OpenSpec y la IA sin delegar el criterio técnico.

> **Restricción de la cátedra:** este documento se versiona en un **commit independiente**, antes de la creación del directorio `openspec/` y antes de cualquier implementación. El historial de Git de este repositorio es la evidencia de ese orden.

---

## 1. Análisis del problema

### 1.1 Identificación de la problemática

La institución universitaria administra la reserva de espacios académicos (laboratorios de investigación y enseñanza, auditoríos y salas de cómputo). Hoy ese proceso **no es un sistema**: es un proceso manual sostenido por correo electrónico y hojas de cálculo.

Ese modelo manual produce cuatro defectos concretos, observados en el día a día:

| # | Defecto | Manifestación observable | Consecuencia |
|---|---|---|---|
| D1 | **Duplicidad de solicitudes** | Dos personas solicitan exactamente la misma franja y nadie se entera hasta que ambas aparecen en el calendario. | Sobrecarga de espacios, conflictos en el uso real de las salas. |
| D2 | **Conflictos de horarios** | La hoja de cálculo se edita desde varias copias y versiones (un `.xlsx` por carrera, por edificio). | Dos reservas confirmadas para el mismo espacio y hora. |
| D3 | **Consulta de disponibilidad costosa** | Para saber si un espacio está libre hay que revisar correos y celdas una por una. | Se reserva a ciegas; el espacio libre se desperdicia. |
| D4 | **Trazabilidad nula** | No se sabe quién pidió, quién aprobó, ni por qué se canceló una reserva. | Impide auditar, dirimir responsabilidades y mejorar la política de uso. |

La causa raíz es común a los cuatro: **no existe una fuente única de verdad** con reglas de integridad aplicadas de forma centralizada y automática. El correo y la hoja de cálculo no pueden, por diseño, garantizar unicidad ni detectar solapamientos.

### 1.2 Necesidades de la institución

**Necesidades funcionales** (lo que el sistema debe hacer):

- **N1.** Registrar y administrar los espacios académicos (código, nombre, tipo, capacidad, ubicación, estado activo/inactivo).
- **N2.** Registrar y administrar usuarios con autenticación segura.
- **N3.** Modelar roles y permisos para separar quién solicita, quién aprueba y quién administra.
- **N4.** Permitir crear solicitudes de reserva con fecha, hora de inicio, hora de fin y justificación.
- **N5.** Validar la disponibilidad del espacio **antes** de aceptar la solicitud.
- **N6.** Prevenir que dos reservas activas se solapen en el mismo espacio (prevención de reservas simultáneas).
- **N7.** Permitir aprobar o rechazar solicitudes, con motivo en el rechazo.
- **N8.** Permitir cancelar reservas y consultar el historial de cada reserva (bitácora de estados).

**Necesidades no funcionales:**

- **NN1. Integridad referencial y transaccional:** una reserva no puede quedar en un estado inconsistente (p. ej. aprobada sin existir el espacio o el solicitante).
- **NN2. Consistencia bajo concurrencia:** dos solicitudes simultáneas sobre la misma franja deben producir **una** reserva activa, no dos. Este es el requisito más crítico del sistema.
- **NN3. Determinismo y auditabilidad:** toda transición de estado debe quedar registrada con autor, marca de tiempo y motivo.
- **NN4. Usabilidad web accesible desde el navegador** sin instalación de cliente.
- **NN5. Arranque reproducible:** cualquier evaluador debe poder levantar el sistema con un comando corto y un entorno limpio.
- **NN6. Mantenibilidad:** el código debe ser modular, tipado y probado de forma automatizada.

También son **necesidades no funcionales implícitas** del contexto académico: el sistema opera en una red institucional, con usuarios no técnicos (docentes, estudiantes, coordinadores) y **sin personal de TI dedicado al mantenimiento**, por lo que se prioriza la simplicidad operativa.

### 1.3 Actores involucrados

| Actor | Descripción | Interacción principal | Rol en el sistema |
|---|---|---|---|
| **Administrador** | Personal de la institución a cargo de la configuración del sistema. | Alta/baja de usuarios, gestión de espacios, configuración de roles, auditoría global. | `ADMIN` |
| **Coordinador** | Responsable académico de un área o facultad. | Aprueba/rechaza solicitudes, consulta la agenda de los espacios que administra. | `COORDINADOR` |
| **Docente** | Cualquier docente que necesita un espacio para una clase, taller o investigación. | Crea solicitudes, consulta disponibilidad, cancela. | `DOCENTE` |
| **Estudiante** | Estudiante que necesita un espacio para una práctica o estudio grupal. | Crea solicitudes, consulta disponibilidad, cancela. | `ESTUDIANTE` |
| **Sistema** | Motor de validación de reglas de negocio. | Comprueba solapamientos, duración, anticipación y horarios; notifica resultados. | Automatizado |

**Matriz de responsabilidades (resumen):**

```
Solicitar   -> ESTUDIANTE, DOCENTE, COORDINADOR, ADMIN
Aprobar     -> COORDINADOR, ADMIN
Gestionar   -> ADMIN (usuarios, espacios, roles)
Consultar   -> todos (agenda propia y, según rol, agenda global)
```

### 1.4 Alcance y limitaciones del sistema

**Dentro del alcance (v1):**

- API REST completa y funcional para las 8 capacidades del enunciado.
- Interfaz web ligera (SPA sin framework de UI) que consume la API.
- Persistencia relacional local con esquema versionado y datos semilla.
- Pruebas automatizadas unitarias y de integración con base de datos aislada por prueba.
- Documentación de OpenSpec: especificaciones, propuestas de cambio, tareas y archivo histórico.

**Fuera del alcance (explícitamente, en v1):**

| Fuera de alcance | Justificación / alternativa en v2 |
|---|---|
| Envío de correos de notificación | No hay servidor SMTP institucional disponible en el entorno de evaluación. La bitácora de eventos (tabla `eventos`) deja el punto de extensión listo y la interface `Notificador` documenta el contrato. |
| Integración con calendarios externos (Google/Outlook, iCal) | Requiere credenciales de terceros. El modelo de datos ya usa fechas ISO-8601 y horas locales explícitas para permitirlo. |
| Aplicación móvil nativa | El problema se resuelve con navegador; una app móvil duplicaría la superficie de prueba. |
| Facturación o cobro por hora** | No fue solicitado por la institución. |
| Multi-sede / multi-institución | El modelo admite `sede_id` como columna futura; no se implementa en v1. |
| Autenticación corporativa (LDAP/SSO) | Requiere infraestructura institucional. El sistema provee autenticación local con hash de contraseña y extensible mediante una interface de proveedor. |
| Dashboard analítico y reportes PDF | Se entrega un dashboard operativo mínimo en la UI; los reportes se posponen para v2. |

**Limitaciones asumidas y aceptadas:**

1. **Alcance temporal del espacio:** las reservas se confinan a una misma fecha civil (no hay reservas que crucen medianoche). Esto simplifica el modelo de solapamiento y es coherente con el uso real del contexto institucional (clases, talleres, auditorías).
2. **Ventana de disponibilidad:** los espacios tienen un horario de funcionamiento configurable (por defecto 08:00–22:00); toda reserva debe caber íntegramente dentro de esa ventana.
3. **Un único espacio por solicitud:** la reserva atómica de varios espacios en un mismo evento se descarta en v1 por no estar solicitada.
4. **Concurrencia limitada a un proceso:** la sección 3.3 justifica por qué esta restricción es aceptable para el despliegue institucional de referencia (ver también R-04 en el registro de riesgos).

---

## 2. Propuesta de solución

### 2.1 Descripción general

Se propone **SIGREA**, un sistema web monolítico modular con API REST y persistencia relacional que **centraliza el ciclo de vida completo de la reserva**:

```
Usuario autenticado
        |
        v
  [1] Catalogo de espacios --> [2] Consulta de disponibilidad
        |                             |
        v                             v
  [3] Solicitud de reserva --> [4] Validacion de reglas (duracion, anticipacion,
        |                          ventana horaria, horario de uso)
        |                             |
        |                             +-- Invalida --> 422 con detalle por regla violada
        v                             |
  [5] Persistencia transaccional + control de solapamiento (bloqueo)
        |
        v
  [6] Estado PENDIENTE --> [7] Aprobacion / Rechazo por Coordinador/Admin
        |                             |
        v                             v
  [8] Cancelacion por el solicitante      [9] Bitacora de historial
```

La **diferencia clave** frente al proceso manual no está en "digitalizar" los correos, sino en que las reglas de integridad se aplican **de forma centralizada, automática y transaccional**. Un solapamiento no es un aviso que un humano puede pasar por alto: es una transacción que no se confirma.

### 2.2 Funcionalidades prioritarias

Priorizadas según el criterio **valor institucional / esfuerzo de implementación** (MoSCoW). `Must` = sin esto el sistema no cumple su propósito.

| # | Funcionalidad | Prioridad | Capacidad OpenSpec |
|---|---|---|---|
| 1 | Autenticación y sesión de usuario | **Must** | `auth` |
| 2 | Registro y administración de usuarios | **Must** | `user-management` |
| 3 | Roles y permisos (RBAC) | **Must** | `rbac` |
| 4 | Catálogo y gestión de espacios académicos | **Must** | `space-management` |
| 5 | Creación de solicitudes de reserva con validación de reglas | **Must** | `reservation-management` |
| 6 | Validación de disponibilidad | **Must** | `availability` |
| 7 | Prevención de reservations simultáneas (control de solapamiento transaccional) | **Must** | `reservation-management` + `availability` |
| 8 | Aprobación y rechazo de solicitudes | **Must** | `reservation-approval` |
| 9 | Cancelación e historial de reservas | **Must** | `reservation-history` |
| 10 | Interfaz web operativa | Should | transversal (UI) |
| 11 | Notificaciones por correo | Won't (v1) | fuera de alcance |
| 12 | Reportes y dashboard analítico | Won't (v1) | fuera de alcance |

> La funcionalidad 7 se considera **Must de máxima prioridad**: es la que elimina el defecto D2 (conflictos de horarios), la causa raíz principal del problema.

### 2.3 Organización del sistema en módulos

El sistema se organiza en **módulos funcionales con fronteras explícitas**, siguiendo el principio de *modular monolith*: una única unidad de despliegue, pero con dependencias dirigidas y prohibidas por convención.

```
src/
├── modules/
│   ├── auth/             -> autenticacion, emision de token, perfil propio
│   ├── user-management/  -> alta/baja/activacion de usuarios
│   ├── rbac/             -> roles, permisos, guards y politicas
│   ├── space-management/ -> catalogo de espacios y sus atributos
│   ├── reservation-management/ -> ciclo de vida de la reserva
│   ├── availability/     -> calculo de franjas libres/ocupadas
│   └── audit/            -> bitacora de eventos (historial)
├── domain/               -> entidades, value objects, errores de dominio, reglas puras
├── db/                   -> conexion, esquema SQL, migraciones, semillas
├── http/                 -> composicion de rutas, middlewares, manejo de errores
└── shared/               -> utilidades transversales (validacion, tiempo, config)
```

**Reglas de dependencia (arquitectura hexagonal simplificada):**

- `domain/` **no depende de nada** del proyecto: es TypeScript puro y testeable sin base de datos.
- `modules/*/domain` y `modules/*/application` dependen de `domain/` y de interfaces (*ports*), nunca de `db/` ni de `http/`.
- `db/` implementa los puertos de persistencia (adaptadores).
- `http/` es el único adaptador de entrada; traduce HTTP <-> casos de uso.
- **Ninguna dependencia entre módulos hermanos**, salvo `rbac` (usado transversalmente) y `audit`. Para romper esa necesidad, los casos de uso publican eventos de dominio en un `bus` de eventos en memoria, y `audit` los consume.

### 2.4 Estrategia de desarrollo progresivo

Desarrollo **vertical** (rejilla de funcionalidades y no de columnas): cada incremento entrega una funcionalidad completa, desde el esquema de base de datos hasta el endpoint y su prueba. Así, en todo momento el sistema es ejecutable y verificable, y ninguna funcionalidad queda "a medio camino".

| Incremento | Entrega | Criterio de salida |
|---|---|---|
| I1 | Cimientos: esquema, configuracion, conexion, servidor, health-check | `GET /api/health` responde 200; `npm test` verde con smoke test |
| I2 | `auth` + `user-management` + `rbac` | Login emite JWT; un `ESTUDIANTE` no puede listar usuarios (403) |
| I3 | `space-management` | CRUD de espacios; el ADMIN puede desactivar un espacio |
| I4 | `availability` | Consulta de franjas de un espacio para una fecha |
| I5 | `reservation-management` + `reservation-approval` | Solicitud, aprobacion/rechazo, solapamiento bloqueado, cancelacion |
| I6 | `reservation-history` + bitacora + UI web | Historial completo de una reserva y agenda por rol |
| I7 | **Cambio 1 (nueva regla de negocio)**: limite de 4 h consecutivas | Regla aplicada y probada |
| I8 | Cierre: verificacion, documentacion final, informe | Trazabilidad completa y suite verde |

---

## 3. Decisiones de arquitectura y tecnología

### 3.1 Arquitectura seleccionada

**Monolito modular en capas (Clean Architecture simplificada) + API REST + SPA estatica.**

```
+-------------------------------------------------------------+
|  Capa de presentacion:  HTTP (Express) + SPA (public/)      |
+-------------------------------+-----------------------------+
                                | DTOs validados (Zod) - middlewares de auth
+-------------------------------v-----------------------------+
|  Capa de aplicacion:  casos de uso por modulo               |
+-------------------------------+-----------------------------+
                                | puertos (interfaces) + eventos de dominio
+-------------------------------v-----------------------------+
|  Capa de dominio:  entidades, reglas puras, errores          |
+-------------------------------+-----------------------------+
                                | contrato de persistencia
+-------------------------------v-----------------------------+
|  Capa de infraestructura:  SQLite (better-sqlite3) + repos   |
+-------------------------------------------------------------+
```

**Justificación:**

- El dominio es un **CRUD transaccional con reglas de integridad**; no hay lógica de dominio que exija distribución. Un microservicio de "reservas" y otro de "espacios" necesitarían transacciones distribuidas para resolver exactamente el problema central (evitar solapamientos), lo cual es **técnicamente más caro y conceptualmente más frágil**.
- Una aplicación única simplifica el despliegue institucional (un proceso Node + un archivo SQLite) y cumple NN5 (arranque reproducible) sin infraestructura adicional.
- La separación en módulos con puertos permite **migrar a PostgreSQL o a servicios separados más adelante sin reescribir el dominio**, lo que responde a la limitación L4.

### 3.2 Stack tecnológico

| Capa | Tecnología | Versión | Justificación |
|---|---|---|---|
| Lenguaje | **TypeScript** | 5.x | Tipado estático en el dominio: reduce la clase de errores más común al trabajar con un agente de IA, y hace auto-documentadas las interfaces de los puertos. |
| Runtime | **Node.js** | >= 20 (LTS) | Runtime con soporte ESM y amplio ecosistema. |
| Framework HTTP | **Express** | 5.x | Maduro, minimalista y con middleware estandar; curva de aprendizaje baja para el mantenimiento futuro. |
| Persistencia | **SQLite** via **better-sqlite3** | 13.x / 3.x | Motor embebido, transaccional y **sin servidor**: un archivo `.db`. Ideal para el despliegue institucional de referencia y para pruebas aisladas por archivo. |
| Acceso a datos | **SQL parametrizado** (sin ORM) | - | Control explicito de las consultas; evita el *overhead* y la opacidad de un ORM en un dominio cuya regla critica es una condicion de solapamiento que debe ser legible y auditable. |
| Validacion | **Zod** | 4.x | Un solo esquema valida entrada HTTP **y** salida de casos de uso; los mensajes de error por campo se traducen directo a la respuesta 422. |
| Autenticacion | **JWT** (`jsonwebtoken`) + **bcrypt** (`bcryptjs`) | - | Tokens firmados stateless y verificables en cada peticion; bcryptjs es JS puro (sin compilacion nativa), lo que evita friccion de instalacion en Windows/Linux del entorno academico. |
| Pruebas | **Vitest** + **Supertest** | 3.x / 7.x | Integracion nativa con TypeScript/ESM (sin transpilar tests por separado) y Supertest permite probar la API HTTP real. |
| Especificacion | **OpenSpec** (CLI `@fission-ai/openspec`) | 1.x | Herramienta de la catedra; impone el flujo *spec -> review -> tasks -> implement*. |
| Frontend | **HTML + CSS + JS nativo** (sin build) | - | Cero dependencias y cero paso de build: la UI es servida como estaticos. Un framework (React/Vue) anadiria toolchain sin aportar al objetivo de trazabilidad. |
| Versionado | **Git** + GitHub | - | Requisito explicito de la catedra: historial que acredite el orden plan -> spec -> codigo -> cambio. |
| Documentacion | **Markdown** (OpenSpec + entregables) | - | Legible por humanos y por el agente de IA en el mismo formato. |

### 3.3 Estrategia de persistencia de datos

**Modelo relacional con 6 tablas y restricciones declarativas.** Se elige el modelo relacional porque el dominio es esencialmente **entidades con relaciones y sobre todo con restricciones de unicidad y de rango temporal**, donde el modelo relacional expresa la invariante de forma nativa y auditable.

**Esquema (resumen; el SQL completo vive en `src/db/schema.sql`):**

| Tabla | Propósito | Restricciones clave |
|---|---|---|
| `usuarios` | Personas registradas | `email` UNIQUE, `password_hash` NOT NULL, `activo` |
| `roles` / `permisos` / `rol_permisos` | RBAC normalizado | `rol_permisos` con PK compuesta (`rol_id`, `permiso_id`) |
| `espacios` | Catalogo de espacios | `codigo` UNIQUE, `tipo` en catalogo, `capacidad` > 0, `activo` |
| `reservas` | Reservas y su estado | FK a `espacios` y `usuarios`, `hora_inicio < hora_fin`, indices compuestos |
| `eventos` | Bitacora de auditoria | FK opcional, `tipo`, `datos` JSON, `creado_en` |

**Decisiones de modelado relevantes:**

1. **Fechas y horas como columnas separadas** (`fecha TEXT 'YYYY-MM-DD'`, `hora_inicio TEXT 'HH:MM'`, `hora_fin TEXT 'HH:MM'`) en vez de un `TIMESTAMP` ISO unico.
   *Ventaja:* la disponibilidad se consulta y se compara por dia sin conversiones, y el requisito de "4 horas consecutivas" se mide directamente sobre minutos. *Coste:* no se soporta el cruce de medianoche (limitación L1 declarada).
2. **Estados explicitos** de la reserva: `PENDIENTE -> APROBADA | RECHAZADA`, y `PENDIENTE | APROBADA -> CANCELADA`. Los estados terminales no transitan; las transiciones invalidas se rechazan con 409.
3. **Solapamiento calculado, no indexado.** En SQLite no existe el predicado `EXCLUDE` de PostgreSQL; se implementa con la condicion de intervalos semiabiertos: `a.hora_inicio < b.hora_fin AND a.hora_fin > b.hora_inicio`, lo que hace que las franjas que se tocan (10:00-11:00 y 11:00-12:00) **no** se consideren solapadas. La condicion se evalua dentro de una transaccion `IMMEDIATE`.
4. **Indices compuestos** en `reservas(espacio_id, fecha, estado)` y `reservas(usuario_id, fecha)` para sostener las consultas de disponibilidad y de carga por usuario.
5. **Integridad referencial con `PRAGMA foreign_keys = ON`** (SQLite lo tiene desactivado por defecto) y `ON DELETE RESTRICT` en `espacios` y `usuarios` referenciados por `reservas`, para que nunca se borre un espacio con historial.
6. **Migraciones por archivo versionado** (`src/db/migrations/NNN_*.sql`) aplicadas de forma idempotente y registradas en `tabla schema_migrations`.

### 3.4 Comparación de decisiones técnicas (con alternativas descartadas)

> La cátedra exige justificar **al menos tres** decisiones comparando con sus alternativas. Se documentan **seis**, ordenadas por criticidad.

---

#### D-1 · Estructura de la aplicacion: **Monolito modular** (elegido) vs. Microservicios (descartado) vs. Monolito en capas "tradicional" (descartado)

| Criterio | Monolito modular (elegido) | Microservicios (descartado) | Monolito en capas tradicional (descartado) |
|---|---|---|---|
| Transaccionalidad del control de solapamientos | Nativa (una transaccion ACID) | Requiere Saga/compensacion o transaccion distribuida | Nativa |
| Complejidad operativa | 1 proceso + 1 archivo DB | N despliegues, N redes, N orquestacion | 1 proceso |
| Tiempo hasta la primera version funcional | Bajo | Alto | Bajo |
| Evolucion futura | Alta (extraccion por modulo) | N/A | Media (acoplamiento por capas) |
| Trazabilidad exigida por la catedra | Alta (un solo historial) | Dificil de evidenciar | Alta |

**Descartados:** los microservicios, porque el requisito critico (NN2, no duplicar franja) se resuelve **peor** que en un monolito y el costo operativo no se justifica en una institucion sin equipo de plataforma; el "monolito en capas tradicional" porque las capas horizontales (`controllers/services/repositories` globales) crean archivos gigantes por funcion y reglas de negocio dispersas, lo que es precisamente lo que OpenSpec (spec-as-code) busca hacer explicito.

---

#### D-2 · Motor de persistencia: **SQLite embebido** (elegido) vs. PostgreSQL (descartado en v1) vs. MySQL/MariaDB (descartado)

| Criterio | SQLite (elegido) | PostgreSQL (descartado) | MySQL (descartado) |
|---|---|---|---|
| Despliegue | Cero: un archivo | Requiere servicio (Docker/VM) | Requiere servicio |
| Entorno de evaluacion | Funciona en cualquier PC con Node | Requiere instalacion y credenciales | Requiere instalacion y credenciales |
| Transacciones ACID / escritura serializada | Si (single writer) | Si | Si |
| Restriccion de solapamientos nativa | No (`EXCLUDE` es de PG) | **Si**: `EXCLUDE USING gist (espacio_id WITH =, tstzrange(...) WITH &&)` | No |
| Pruebas aisladas | Trivial: un archivo por test | Testcontainers o contenedor | Contenedor |
| Escalabilidad de escritura | Limitada (1 escritor) | Alta | Alta |

**Descartado PostgreSQL** --con una salvedad honesta: es la opcion tecnicamente superior para el control de solapamientos (podria delegar la invariante al motor con `EXCLUDE`), pero exige infraestructura que no existe en el entorno de la institucion y que el evaluador tendria que instalar para simplemente ver el sistema funcionando. **La invariante se implementa en la capa de aplicacion dentro de una transaccion `IMMEDIATE`**, lo que, en un unico proceso, SQLite serializa las escrituras y garantiza la exclusion. *Mitigacion:* el repositorio de reservas esta aislado tras un puerto (`ReservationRepository`), y el plan de contingencia (R-04) documenta la migracion a PostgreSQL + `EXCLUDE` si la institucion pasa a multi-instancia.

---

#### D-3 · Acceso a datos: **SQL parametrizado con repositorios propios** (elegido) vs. Prisma (descartado) vs. TypeORM (descartado)

| Criterio | SQL + repositorios (elegido) | Prisma (descartado) | TypeORM (descartado) |
|---|---|---|---|
| Legibilidad de la regla de solapamiento | Total (la condicion se lee tal cual es la regla de negocio) | Correcta, pero la logica de filtro queda en la capa de aplicacion | Media (metadata + decoradores) |
| Control de transacciones | Explicito (`BEGIN IMMEDIATE` / `COMMIT`) | Menos granular; transaccion interactiva con lifetime acoplado al cliente | Correcto pero verboso |
| Overhead en runtime | Nulo | Capa de traduccion | Capa de traduccion |
| Dependencias y complejidad de build | Minima | Cliente generado + motor | Mucha metadata + Reflect metadata |
| Riesgo con codigo generado por IA | Bajo: el SQL es explicito y revisable | Medio: el esquema se genera y se desincroniza | Medio |

**Descartados ambos ORM** porque (a) la condicion de solapamiento --el corazon del sistema-- debe poder leerse y auditarse en el repositorio, sin capas de abstraccion intermedias, y (b) reducen la superficie de herramientas que la IA puede desalinear respecto de la especificacion.

---

#### D-4 · Identidad y sesion: **JWT stateless** (elegido) vs. Sesiones en servidor (descartado) vs. Tokens opacos en base de datos (descartado)

| Criterio | JWT (elegido) | express-session (descartado) | Tokens opacos (descartado) |
|---|---|---|---|
| Estado en el servidor | Ninguno | Alto (store de sesiones) | Medio (tabla de tokens) |
| Escalado horizontal | Trivial (cualquier instancia valida) | Requiere store compartido | Requiere store compartido |
| Revocacion inmediata | No (se resuelve con `token_version` del usuario) | Si | Si |
| Complejidad | Baja (firma HMAC + expiracion) | Media | Media |
| Requisito de logout | Se resuelve incrementando `token_version` | Nativa | Nativa |

**Descartada la sesion en servidor** porque anade un store (y, en un despliegue horizontal, su infraestructura) sin aportar al objetivo del sistema. **La revocacion** --necesaria cuando se desactiva un usuario-- se resuelve incrementando `token_version` del usuario: los tokens emitidos antes quedan invalidos de inmediato.

---

#### D-5 · Pruebas: **Vitest + Supertest** (elegido) vs. Jest (descartado) vs. Pruebas manuales (descartado)

| Criterio | Vitest + Supertest (elegido) | Jest (descartado) | Manual (descartado) |
|---|---|---|---|
| TypeScript/ESM | Nativo, sin `ts-jest` ni flags | Requiere configuracion extra (`ts-jest`, `isolatedModules`) | N/A |
| Velocidad | Muy alta (worker nativo, sin sandbox legacy) | Media | Nula |
| Prueba HTTP end-to-end | `supertest` sobre la app sin abrir puerto | Posible | N/A |
| Aislamiento de base de datos | Un archivo SQLite por test | Igual | N/A |
| Requisito "pruebas automatizadas" | Cumplido | Cumplido | **No cumple** |

**Descartado Jest** por friccion de configuracion con ESM/TypeScript; **descartada la validacion manual** por no cumplir el entregable explicito 4.

---

#### D-6 · Interfaz de usuario: **SPA nativa servida por Express** (elegido) vs. React/Vite (descartado) vs. Solo API REST (descartado)

| Criterio | SPA nativa (elegido) | React/Vite (descartado) | Solo API (descartado) |
|---|---|---|---|
| Build step | Ninguno | Obligatorio (bundle, `node_modules` extra) | - |
| Curva de mantenimiento | Baja (HTML+JS) | Media | - |
| Verificabilidad por el evaluador | Abrir el navegador | Instalar y construir | Necesita un cliente HTTP |
| Valor para el objetivo del proyecto | Alto: demuestra la regla de negocio al usuario final | Medio | Bajo |
| Coste de dependencias | Cero | Alto | - |

**Descartados React/Vite y la opcion "solo API"**: el primero introduce un pipeline de build que no aporta al objetivo de trazabilidad y el segundo entrega un sistema que la institucion no podria adoptar sin escribir su propia interfaz. La UI nativa consume exactamente los endpoints definidos en OpenSpec, de modo que la UI es ademas un **cliente de prueba de la API**.

---

### 3.5 Organizacion de componentes (resumen operativo)

- **Modulos** con dos capas internas: `application` (casos de uso y puertos) y `domain` (entidades y reglas).
- **Repositorios** en `db/repositories` implementan los puertos; un **modulo de arranque** (`src/container.ts`) cablea dependencias -> un unico punto de composicion.
- **Middleware HTTP** para: autenticacion (`authenticate`), autorizacion (`authorize(permiso)`), validacion de entrada (`validate(schema)`), y manejo centralizado de errores -> respuestas JSON consistentes.
- **Bus de eventos en memoria** (`shared/eventBus`) desacopla la escritura de la bitacora (`audit`) del caso de uso que la origina.
- **Codigo de error de dominio** (`DominioError` con `status` y `detalles[]`) traducido 1:1 a respuestas HTTP: `400/401/403/404/409/422`.

---

## 4. Estrategia de desarrollo

### 4.1 Metodologia de trabajo

**SDD (Spec-Driven Development) con OpenSpec**, en un ciclo cerrado de cuatro pasos por funcionalidad:

```
   +--------------+   +---------------+   +---------------+   +--------------+
   |  1. SPEC     |-->|  2. REVIEW    |-->|  3. TASKS     |-->|  4. IMPLEMENT |
   | Especificar |   | Revisar y     |   |  Desglosar   |   |  Construir y  |
   | (OpenSpec)  |   |  corregir    |   |  en tareas   |   |  probar      |
   +--------------+   +---------------+   +---------------+   +------+-------+
          ^                                                                |
          +-------- 5. CAMBIO / EVOLUCION (propuesta -> spec -> codigo) <-+
```

**Reglas de trabajo innegociables (definidas por el estudiante, no por la IA):**

1. **Ninguna linea de codigo de una funcionalidad antes de que su especificacion este aprobada** (Fase 2 revisada).
2. Toda funcionalidad se entrega con **pruebas** que referencian explicitamente los escenarios de aceptacion de la especificacion.
3. **Un commit = una unidad funcional coherente**, con mensaje que referencia el ID de la especificacion/cambio.
4. El agente de IA **propone**; el estudiante **decide y revisa**. Toda decision de arquitectura y de negocio queda en el codigo y en el informe final, no en el chat.
5. Los cambios funcionales **nunca** se editan directamente sobre `src/`: primero se crea un *change* de OpenSpec.

### 4.2 Etapas de implementacion

| Etapa | Contenido | Entradas | Salidas |
|---|---|---|---|
| **E1. Cimientos** | Esquema SQL, config, conexion, repos base, servidor, health-check, logger | Plan de ingenieria | App que arranca; smoke test verde |
| **E2. Identidad** | `auth`, `user-management`, `rbac` | Specs de esas capacidades | Login, gestion de usuarios, guards por permiso |
| **E3. Espacios** | `space-management` | Spec de espacios | CRUD de espacios + tipos |
| **E4. Disponibilidad** | `availability` | Spec de disponibilidad | Consulta de franjas por espacio y fecha |
| **E5. Reservas** | `reservation-management`, `reservation-approval` | Specs correspondientes | Crear/aprobar/rechazar/cancelar con control de solapamiento |
| **E6. Historial y UI** | `reservation-history`, SPA | Spec de historial | Bitacora, agenda y panel de aprobaciones |
| **E7. Cambio de negocio** | Regla de 4 h consecutivas | *Change* de OpenSpec | Regla implementada, probada y documentada |
| **E8. Cierre** | Verificacion, `README.md`, `INFORME_FINAL.md` | Todo lo anterior | Repositorio completo y auditable |

### 4.3 Orden de desarrollo de funcionalidades y dependencias

```
E1 (cimientos)
 |---> E2 (identidad) ---+
 |---> E3 (espacios)  ---+---> E5 (reservas) ---> E6 (historial + UI) ---> E7 (cambio 4h) ---> E8 (cierre)
 +---> E4 (disponibilidad) -+
```

- **E2 -> E5:** toda reserva tiene un `usuario_id` y toda accion tiene un autor -> RBAC es prerrequisito.
- **E3 -> E4/E5:** no hay disponibilidad ni reserva sin espacios -> catalogo primero.
- **E4 -> E5:** el caso de uso de creacion de reserva **reutiliza** el servicio de disponibilidad (no se duplica la logica de solapamiento). Se evita la duplicacion que era precisamente el defecto del proceso manual.
- **E5 -> E6:** el historial se escribe como parte del ciclo de vida de la reserva, no como un modulo aparte ("historial reconstruido").
- **E6 -> E7:** el cambio de la regla de 4 h solo puede evaluarse si existe el historial y la bitacora que lo evidencian.

### 4.4 Criterios de "terminado" (Definition of Done) por etapa

Una etapa se considera terminada cuando **todas** las condiciones se cumplen:

| # | Criterio | Verificable por |
|---|---|---|
| D1 | La especificacion de la capacidad existe, fue revisada y no tiene requisitos ambiguos | `openspec validate` sin errores + revision documentada en el change |
| D2 | La implementacion existe en `src/` respetando la arquitectura de modulos | Revision de codigo contra la seccion 3.1 |
| D3 | Existe al menos una prueba por escenario de aceptacion de la spec | `npm test` + matriz requisito->test en `docs/TRAZABILIDAD.md` |
| D4 | La suite completa pasa sin fallos | `npm test` con salida verde y cobertura reportada |
| D5 | `npm run typecheck` (TypeScript estricto) no reporta errores | `tsc --noEmit` |
| D6 | `npm run lint` no reporta errores | ESLint |
| D7 | Los cambios estan registrados en Git con mensaje trazable | `git log` |
| D8 | El comportamiento observable esta documentado en `README.md` | Lectura del README |

> Estos criterios son **la Definition of Done del estudiante** y son los que se aplican a las etapas E1-E8. Cualquier funcionalidad que no cumpla D1-D8 no se considera entregada.

---

## 5. Estrategia de calidad

### 5.1 Tipos de pruebas que se realizaran

| Nivel | Que verifica | Herramienta | Volumen objetivo |
|---|---|---|---|
| **Unitarias (dominio)** | Reglas puras: solapamiento de intervalos, calculo de duracion, validez de transiciones de estado, comparacion de horas, matriz de permisos | Vitest, sin base de datos | ~40 pruebas |
| **Integracion (API)** | Endpoints reales contra base de datos temporal: 401/403/404/409/422, flujo completo de una reserva, control de solapamiento, RBAC efectivo | Vitest + Supertest + SQLite en memoria o archivo temporal | ~60 pruebas |
| **Regresion** | Que el cambio de la regla de 4 h no rompa las funcionalidades existentes | Suite completa ejecutada tras cada cambio | Suite completa |
| **Aceptacion (manuales)** | Recorrido de los 8 escenarios de aceptacion de usuario tal como los describe OpenSpec | Script `npm run verify` + checklist manual en `INFORME_FINAL.md` | 8 escenarios |
| **Estaticas** | Errores de tipos y estilo | `tsc --noEmit` (modo estricto), ESLint | 100 % del codigo |

**Reglas de cobertura aplicadas al dominio:** las funciones que implementan las reglas de negocio *criticas* (solapamiento, duracion, transiciones) deben tener cobertura de rama del **100 %**; el resto del proyecto, >= 80 % de lineas.

### 5.2 Identificacion de riesgos (>= 5) y estrategias de mitigacion

| ID | Riesgo | Prob. | Impacto | Estrategia de mitigacion |
|---|---|---|---|---|
| **R-01** | **La IA genera codigo que contradice la especificacion** (p. ej. permite solapamientos, acepta transiciones invalidas o aplica mal los permisos). | Alta | Critico | 1) Especificaciones con escenarios de aceptacion **nominales y verificables** (texto exacto de los codigos de error). 2) Pruebas de integracion que **derivan de los escenarios**, no del codigo. 3) Revision humana linea por linea del diff contra la spec. 4) `Definition of Done` D1-D8 que bloquea el commit si falla D3-D6. 5) Reglas de arquitectura verificadas por lint. |
| **R-02** | **Fuga de informacion o de autorizacion** (un usuario ve o modifica lo que no deberia). | Media | Critico | RBAC con permisos granulares y verificacion **efectiva** (no solo declarada) en la capa HTTP; pruebas negativas por cada permiso (403 esperado); hash bcrypt con salt; secretos por variable de entorno; CORS restrictivo; respuestas de error sin filtrar stack traces en produccion. |
| **R-03** | **Condicion de carrera en el control de solapamientos** (dos solicitudes concurrentes en la misma franja). | Media | Critico | Transaccion `BEGIN IMMEDIATE` (bloqueo de escritura) alrededor de *verificacion + insercion*; re-verificacion dentro de la transaccion; indice compuesto que acelera la consulta de solapamiento; prueba de concurrencia con `Promise.all` sobre el mismo espacio/hora. |
| **R-04** | **Limite de escalado de SQLite** (un solo escritor; posible bloqueo con muchas escrituras concurrentes). | Baja | Medio | El perfil de uso real de la institucion (decenas de reservas/dia) esta muy por debajo del limite; las escrituras son transaccionales y de corta duracion; el puerto `ReservationRepository` permite migrar a PostgreSQL + `EXCLUDE` sin tocar el dominio; documentado como limitacion L4 y en el plan de contingencia del informe final. |
| **R-05** | **Reglas de negocio ambiguas en la especificacion** (p. ej. ¿"4 horas consecutivas" incluye reservas contiguas del mismo usuario? ¿cual es la anticipacion maxima?). | Alta | Alto | Fase 2 de revision **obligatoria** antes de implementar: cada ambiguedad se convierte en un requisito con valor por defecto explicito y un escenario de aceptacion que la fija; los supuestos se registran en `openspec/changes/*/proposal.md` y en `INFORME_FINAL.md`. |
| **R-06** | **Divergencia entre plan, especificacion y codigo** (la documentacion queda desactualizada). | Media | Alto | `docs/TRAZABILIDAD.md` con matriz requisito->escenario->test->archivo; el informe final registra toda decision modificada; OpenSpec mantiene el registro de cambios; commits etiquetados por capacidad. |
| **R-07** | **Perdida o corrupcion de la base de datos** (disco lleno, proceso muerto a mitad de escritura). | Baja | Alto | SQLite en modo WAL con `synchronous = FULL`; transacciones explicitas; `PRAGMA integrity_check` en el health-check; script de respaldo `npm run db:backup`; `foreign_keys = ON`. |
| **R-08** | **Dependencias o paquetes maliciosos / cadena de suministro** (supply chain). | Media | Alto | Versiones fijadas con lockfile (`package-lock.json`); instalacion con `npm ci`; revision del lockfile en cada actualizacion; sin dependencias de cliente (la UI es nativa) para reducir la superficie. |
| **R-09** | **Comportamiento no determinista por dependencia del entorno** (horas del sistema, zona horaria, fechas "hoy"). | Media | Medio | Tiempo del negocio siempre en UTC con ISO-8601; el "hoy" se calcula contra una **referencia inyectable** (`reloj` del dominio) para que las pruebas no dependan del reloj real; las pruebas de anticipacion fijan un reloj de prueba. |
| **R-10** | **Tiempo de verificacion creciente** hasta que la suite sea inmanejable. | Media | Medio | Suite rapida por defecto (< 30 s), pruebas aisladas y paralelizables, BD en memoria por archivo de test, y un `npm run verify` que ejecuta typecheck + lint + tests + validacion OpenSpec. |

### 5.3 Mecanismos para verificar el cumplimiento de requisitos

| Mecanismo | Que comprueba | Cuando |
|---|---|---|
| `openspec validate --strict` | Que cada capacidad y cada cambio tienen requisitos y escenarios validos en formato OpenSpec | Pre-commit de cada capacidad y de cada cambio |
| `openspec list` / `openspec show <cap>` | Que la especificacion existe y esta vigente antes de implementar | Inicio de cada etapa E2-E7 |
| `openspec archive <change>` | Cierra formalmente un cambio ya implementado y verificado | Fin de E7 |
| `npm run typecheck` | Correccion de tipos en modo estricto (detecta errores de IA) | Cada commit |
| `npm run lint` | Estilo y reglas de arquitectura | Cada commit |
| `npm test` | Suite completa (unitarias + integracion) | Cada commit; bloqueante |
| `npm run verify` | typecheck + lint + tests + validacion OpenSpec | Antes de cada tag/entrega |
| `docs/TRAZABILIDAD.md` | Matriz requisito -> escenario -> prueba -> archivo de implementacion | Actualizada en cada etapa |
| `git log` con mensajes trazables | Secuencia temporal plan -> spec -> implementacion -> cambio -> verificacion | Revision final |

---

## 6. Uso de SDD e inteligencia artificial

### 6.1 ¿Como se utilizara OpenSpec?

OpenSpec se usa como **fuente de verdad ejecutable del comportamiento esperado**, con este flujo dentro de `/openspec`:

```
openspec/
├── project.md              -> contexto, stack y convenciones del proyecto
├── AGENTS.md               -> contrato de trabajo para el agente de IA
├── specs/                  -> estado actual (una carpeta por capacidad)
│   ├── auth/spec.md
│   ├── user-management/spec.md
│   ├── rbac/spec.md
│   ├── space-management/spec.md
│   ├── availability/spec.md
│   ├── reservation-management/spec.md
│   ├── reservation-approval/spec.md
│   └── reservation-history/spec.md
└── changes/                -> propuestas en curso y archivo historico
    └── <change-id>/
        ├── proposal.md      -> POR QUE (motivo, alcance, impacto)
        ├── design.md        -> COMO (decisiones tecnicas de la implementacion)
        ├── tasks.md         -> lista de tareas de implementacion (checklist)
        └── specs/<cap>/spec.md -> delta de requisitos (ADDED/MODIFIED/REMOVED)
```

**Reglas de uso:**

1. `openspec init` se ejecuta **despues** del commit del plan de ingenieria, nunca antes (restriccion de la catedra).
2. Cada capacidad se crea con `openspec init <capability>` y se redacta siguiendo la plantilla oficial: `## ADDED Requirements` -> `### Requirement: <nombre>` -> bloques `WHEN/SHALL` + `#### Scenario:`.
3. **Ningun requisito se implementa sin estar en `specs/`**, y ningun cambio de comportamiento se aplica al codigo sin un `change/` que lo documente.
4. `openspec validate --strict` debe pasar **sin errores** antes de cada commit de implementacion.
5. `openspec archive` mueve un cambio implementado a `changes/archive/` y fusiona su delta en `specs/`, dejando el registro historico.

### 6.2 ¿Como se transformara el plan de ingenieria en especificaciones?

La transformacion es **explicita, seccion por seccion**, y cada capability OpenSpec nace de una necesidad del plan:

| Fuente en `PLAN_INGENIERIA.md` | Especificacion OpenSpec derivada | Requisitos / escenarios resultantes |
|---|---|---|
| N1 + §3.3 | `specs/space-management` | 5 requisitos: catalogo, alta, tipos, edicion, desactivacion |
| N2 + §3.3 | `specs/user-management` | 4 requisitos: registro, duplicados, desactivacion, listados |
| N3 + §3.4 (D-4) | `specs/rbac` | 4 requisitos: catalogo de roles, matriz de permisos, guards, denegacion 403 |
| N1 + §4.3 | `specs/auth` | 4 requisitos: credenciales, hash, token, sesion invalida |
| N4 + §4.3 | `specs/reservation-management` | 6 requisitos: creacion, datos validos, ventana horaria, anticipacion, estados, cancelacion |
| N5 | `specs/availability` | 4 requisitos: franjas ocupadas, franjas libres, espacios inactivos |
| N6 + §3.4 (R-03) | `specs/reservation-management` (requisito de no solapamiento) + `specs/availability` | 3 requisitos: exclusion de franjas, atomicidad, franjas contiguas |
| N7 + §1.3 | `specs/reservation-approval` | 5 requisitos: quien aprueba, aprobacion, rechazo con motivo, transiciones invalidas, auto-aprobacion |
| N8 + §3.3 | `specs/reservation-history` | 4 requisitos: bitacora de estados, filtros, auditoria, retencion |

**Regla de transformacion (la "fase 2" del enunciado):** cada requisito de la spec debe ser **verificable** -- una prueba automatizada debe poder pasar/fallar segun el comportamiento descrito. Se rechaza todo enunciado ambiguo: si un requisito admite dos interpretaciones razonables, se reescribe hasta que solo admita una.

**Ejemplo del antes/despues** (ambiguedad detectada en revision):

- **Ambiguo (descartado):** "El sistema debe permitir reservar espacios por un maximo de 4 horas."
  (¿Y si el usuario hace dos reservas contiguas de 3 h? ¿Y si la reserva cruza la noche?)
- **Verificable (adoptado):** **"REQ-RES-006 -- Limite de duracion por reserva.** *WHEN* un usuario autenticado crea una reserva cuya duracion (hora_fin - hora_inicio) excede 240 minutos, *THEN* la API debe responder `422` con el codigo `DURACION_EXCEDIDA` y no debe persistir la reserva."
  **"REQ-RES-007 -- Limite de horas consecutivas del mismo usuario.** *WHEN* un usuario crea una reserva en un espacio y fecha donde la union de sus reservas contiguas o solapadas excede 240 minutos, *THEN* la API debe responder `422` con el codigo `HORAS_CONSECUTIVAS_EXCEDIDAS`."

### 6.3 ¿Que actividades se delegaran a la IA?

**Se delega (tarea mecanica + repetitiva, con criterio ya definido):**

| Actividad delegable | Entrada que recibe | Revision humana requerida |
|---|---|---|
| Redaccion inicial de `spec.md` por capacidad | Las necesidades N1-N8 del plan y el esquema de OpenSpec | [OK] Total: el estudiante reescribe/rechaza cada requisito |
| Generacion de migraciones y repositorios | El esquema de dominio y las tablas del plan | [OK] Total |
| Generacion de endpoints y DTOs con Zod | Los contratos de la spec | [OK] Total |
| Generacion de pruebas unitarias | Los escenarios de aceptacion | [OK] Total: se verifica que el test realmente deriva del escenario |
| Generacion de stubs de la UI | Los endpoints documentados | [OK] Parcial |
| Documentacion (README, informe) | Hechos verificables del repositorio | [OK] Total: no se permite afirmar lo que no se verifico |
| Deteccion de inconsistencias entre spec y codigo | Diff entre `openspec/` y `src/` | [OK] Revision del reporte |

**No se delega (decision tecnica y de negocio del estudiante):**

| Actividad | Por que no se delega |
|---|---|
| Definicion del modelo de dominio y de los estados de la reserva | Es la decision de negocio central; delegarla elimina el valor del proyecto |
| Eleccion de arquitectura, stack y persistencia (§3) | Es el objeto de evaluacion de esta etapa |
| Definicion de la matriz de roles y permisos | Decision institucional, no tecnica |
| Reglas de solapamiento y de las 4 horas | Nucleo del requisito y de la fase de gestion de cambios |
| Resolucion de ambiguedades en la revision de specs | Es el ejercicio de ingenieria que se esta evaluando |
| Aceptacion final del codigo y de la documentation | Responsabilidad tecnica explicita en el enunciado |

### 6.4 ¿Como se verificara el codigo generado?

Se aplican **cinco barreras de verificacion** en cascada; el codigo generado no llega al repositorio hasta superarlas:

| # | Barrera | Mecanismo | Falla => |
|---|---|---|---|
| B1 | **Trazabilidad** | Cada test se anota con el ID del requisito que verifica (`REQ-RES-006`); `docs/TRAZABILIDAD.md` mapea requisito -> escenario -> test -> archivo | Requisito no implementado o mal cubierto |
| B2 | **Tipos** | TypeScript en modo estricto (`strict: true`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) | El codigo no compila => no se revisa a fondo |
| B3 | **Logica** | Suite automatizada: unitarias de reglas + integracion de API; **pruebas negativas** obligatorias por cada permiso y por cada estado invalido (401/403/404/409/422) | Escenario de aceptacion incumplido |
| B4 | **Revision humana del diff** | El estudiante lee el diff completo contra la spec, buscando: reglas duplicadas, atajos (p. ej. `catch {}`), permisos no verificados, queries sin parametros, `any`, TODOs | Se corrige y se vuelve a pasar por B1-B3 |
| B5 | **Conformidad con OpenSpec** | `openspec validate --strict` + revision manual de que el comportamiento observable coincide con la spec (codigos de error incluidos) | El cambio no se archiva; el codigo no se acepta |

**Regla anti-IA-nerviosa:** *si una prueba falla, primero se duda de la especificacion y luego del codigo, nunca al reves de forma automatica*. Un fallo de test se diagnostica contra el escenario de aceptacion, y el resultado (bug de codigo o spec ambigua) se documenta en `INFORME_FINAL.md`. Esa trazabilidad de los **hallazgos** es tan importante como la de los requisitos.

### 6.5 ¿Que decisiones seran responsabilidad del estudiante?

| Decision | Momento | Evidencia en el repositorio |
|---|---|---|
| Analisis del problema y alcance | Antes de especificar | `PLAN_INGENIERIA.md` §1 |
| Arquitectura, stack y persistencia | Antes de implementar | `PLAN_INGENIERIA.md` §3 + `openspec/project.md` |
| Modelo de dominio y estados | Fase de specs | `openspec/specs/*/spec.md` |
| Matriz de roles y permisos | Fase de specs | `specs/rbac/spec.md` + semilla de la BD |
| Reglas de negocio (solapamiento, anticipacion, duracion) | Fase de specs y Fase 4 | Specs + `docs/TRAZABILIDAD.md` |
| Revision, correccion y priorizacion de specs | Fase 2 | Notas de revision en los `changes/` y en `INFORME_FINAL.md` |
| Aceptacion del codigo de la IA | Fase 3 | Diffs revisados + `git log` |
| Gestion del cambio de las 4 horas | Fase 4 | `openspec/changes/limit-4-horas-consecutivas/` |
| Estado final y conclusiones | Fase 5 | `INFORME_FINAL.md` |

---

## 7. Trazabilidad del proceso (compromiso con la catedra)

| Momento | Evidencia en Git | Artefacto OpenSpec |
|---|---|---|
| Plan de ingenieria aprobado | **Commit independiente** `docs(plan): plan de ingenieria` | -- (OpenSpec aun **no** existe) |
| Especificaciones redactadas | Commit `spec(specs): ...` | `openspec/specs/**` |
| Specs revisadas y tareas definidas | Commit `spec(review): ...` | `openspec/changes/**/tasks.md` |
| Implementacion por etapa | Commits `feat(<capacidad>): ...` | Specs vigentes, validadas |
| Cambio de regla de negocio | Commit `spec(change): regla de 4 h ...` | `openspec/changes/limit-4-horas-consecutivas/` |
| Implementacion del cambio | Commit `feat(reservations): ...` + `test: ...` | Delta de spec aplicado |
| Cierre y verificacion | Commit `docs(final): ...` | `openspec/changes/archive/**` + `INFORME_FINAL.md` |

---

## 8. Conclusiones de la Etapa 1

1. El problema no es "falta una aplicacion web", sino la **ausencia de una fuente unica de verdad con integridad transaccional**; la solucion se centra en garantizar la unicidad de la franja reservada.
2. La decision tecnica dominante es **monolito modular + SQLite con control de solapamiento en transaccion**, justificada frente a microservicios, PostgreSQL, ORMs, sesiones en servidor, Jest y React/Vite (comparacion en §3.4).
3. El desarrollo se planifica **verticalmente** (I1-I8) para que el sistema sea ejecutable y verificable en todo momento, con una Definition of Done explicita (§4.4).
4. El riesgo dominante no es tecnico sino **de proceso**: que la IA implemente algo distinto de lo especificado. Se mitiga con requisitos verificables nominales, pruebas derivadas de los escenarios, revision del diff y validacion OpenSpec.
5. La nueva regla de las 4 horas se anticipa como **cambio gestionado** (Fase 4), con analisis de impacto, delta de especificacion, escenarios nuevos y pruebas, antes de tocar el codigo.

**Este documento se versiona en un commit independiente, previo a la creacion de `openspec/` y a la implementacion.**

---

## Addendum. Chapter 9 — Impacto de la nueva regla de negocio (Fase 4)

> **Este capitulo se anadio durante la Fase 4 de la ETAPA 2**, cuando la institucion solicito la nueva regla de negocio: *ningun usuario podra reservar un espacio academico durante mas de cuatro horas consecutivas*.
>
> **El contenido anterior (capitulos 1 a 8) NO se modifica.** El commit de la ETAPA 1 permanece intacto en el historial de Git, de modo que se conserva la evidencia del orden plan -> especificacion -> implementacion. Este addendum documenta el analisis de impacto exigido por la Fase 4 ("Revisar si afecta su plan de ingenieria").

### 9.1 Natureza del impacto

La regla **anade una restriccion de negocio que el plan original no contemplaba**. El plan defini las restricciones de la reserva en terminos de *espacio* (horario de funcionamiento), *fecha* (no puede estar en el pasado, anticipacion minima) y *franja* (duracion minima, no solapamiento), pero no establecia ningun tope de duracion ni ninguna restriccion acumulada por persona.

Por tanto el impacto es de **ampliacion del alcance funcional**, no de contradiccion del plan. Las decisiones tecnicas del plan **resultan confirmadas** por el cambio, no invalidadas:

| Decision del plan | Efecto de la regla nueva | Veredicto |
|---|---|---|
| §3.3 Modelo temporal `fecha` + `hora` local | Es lo que hace posible calcular la union de intervalos sin conversiones de zona horaria ni de instante. | **Confirmada y reforzada** |
| §3.3 Intervalos semiabiertos `[inicio, fin)` | Permite fusionar franjas contiguas sin que un contacto en el extremo genere dos bloques. | **Confirmada** |
| §3.3 Indice `reservas(usuario_id, fecha)` | Ya existia en el esquema por el filtro por solicitante; el computo de la regla lo reutiliza. **No hace falta ninguna indice nuevo.** | **Confirmada y aprovechada** |
| §3.4 D-3 (SQL sin ORM) | El computo es una consulta simple mas una fusion en memoria; un ORM habria añadido indireccion sin aportar nada. | **Confirmada** |
| §3.4 D-2 (SQLite) | La regla no exige consultas espaciales ni funciones de rango, asi que no cambia el argumento de la decision. | **Sin efecto** |
| §3.1 Reglas puras en el dominio | `fusionarIntervalos` ya existía en `src/domain/tiempo.ts` y esta probada: la regla la reutiliza sin anadir logica temporal nueva. | **Confirmada** |
| §3.4 D-3 transaccion `IMMEDIATE` | Es la garantia que hace que el computo de las horas consecutivas y la insercion sean atomicos. Si la regla se hubiera implementado fuera de la transaccion, se habria reintroducido una condicion de carrera. | **Confirmada; su papel se amplia** |
| §1.4 Limitacion L1 (una fecha civil) | Pasa de ser una simplificacion comoda a ser **imprescindible**: el computo de bloques continuos se hace por fecha. | **Reforzada** |
| §5.2 Riesgos | Se anade **R-11**: la regla puede rechazar combinaciones legitimas de franjas y frenar la actividad de un docente con agenda fragmentada. | **Riesgo nuevo identificado** |
| §4.4 Definition of Done | La regla se sigue el mismo circuito: change de OpenSpec -> especificacion -> tareas -> implementacion -> pruebas -> archivado. | **Sin cambios** |

### 9.2 Ambiguedad de la regla y su resolucion

El enunciado admite dos lecturas, documentadas en el `proposal.md` del change:

- **Lectura A (por espacio):** el limite se aplica a las reservas de un mismo usuario **en un mismo espacio**. Un docente podria reservar 3 h en cada uno de tres espacios contiguos sin incumplir la norma.
- **Lectura B (por usuario y fecha):** el limite se aplica a la **union de todas las reservas del usuario en una fecha**, con independencia del espacio.

**Se adopta la lectura B** porque el sujeto de la norma es la persona usuaria ("ningun usuario podra..."), porque la lectura B **contiene** a la lectura A (ninguna combinacion que vulnere A escapa a B) y porque satisface la intencion de fondo de la institucion (uso equitativo de recursos). La lectura A admite un abuso evidente.

La lectura B se implementa sobre la **union de los intervalos** y no sobre la suma de duraciones: las franjas separadas por un hueco rompen la continuidad y no se acumulan.

### 9.3 Cambios derivados que se aplican al plan

1. **§1.2 Necesidades:** se anade la necesidad N9, "limitar el uso de los espacios por persona". El objetivo general del plan no cambia: se refuerza, porque la regla centraliza una restriccion que antes no existia.
2. **§3.3 Persistencia:** se documenta que el indice `reservas(usuario_id, fecha)` cumple una segunda funcion, y que **no se requiere migracion de esquema** para la regla.
3. **§5.2:** se registra el riesgo **R-11** con su mitigacion (mensaje de error que indica el bloque continuo conflictivo y limite configurable por entorno).
4. **§6.2:** la regla confirma la validez del ejemplo de transformacion anticipado en la planificacion: los dos requisitos que el plan ilustro (limite por reserva y limite de horas consecutivas del mismo usuario) son exactamente los que se han implementado.

### 9.4 Lo que el plan NO preveia (deuda documentada)

El plan no preveia tres aspectos que la implementacion ha tenido que resolver. Se registran como **deuda consciente**, no como errores del plan:

1. **La regla no se aplica retroactivamente.** Las reservas ya existentes no se revalidan. Revalidarlas exigiria una politica de negocio sobre reservas ya concedidas (dejar, recortar o cancelar) que la institucion no ha definido. Queda documentado como pregunta abierta en el `design.md` del change.
2. **El limite de "horas consecutivas" se computa por usuario y fecha, no por rol.** La institucion no fija la excepcion por rol (por ejemplo, que un coordinador pueda reservar mas tiempo para eventos institucionales). Si se requiere, es un change nuevo.
3. **El limite es global para el conjunto de la institucion, no por edificio o area.** El modelo de datos lo permitiria anadiendo una dimension, pero no se ha anadido por no haberlo solicitado.

### 9.5 Conclusion del addendum

La revision del plan exigida por la Fase 4 **confirma** el modelo temporal, el indice `(usuario_id, fecha)`, la transaccion `IMMEDIATE` y la reutilizacion de las reglas puras del dominio. El unico ajuste material es la ampliacion del alcance funcional con la necesidad N9 y el registro del riesgo R-11.

**Conclusion:** el plan resulto tecnicamente correcto frente a la regla nueva, sin necesidad de revocar ninguna decision. La especificacion previa (ETAPA 2, Fase 1 y 2) ya anticipaba los dos requisitos de la regla, lo que evidencia el valor de especificar antes de implementar.
