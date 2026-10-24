# Design — Sistema de Gestion de Reservas de Espacios Academicos (SIGREA)

> Documento tecnico de la **Fase 2 de la ETAPA 2** (revision de especificaciones).
> El "por que" esta en `proposal.md`; el "que" esta en `specs/**/spec.md`; este documento explica el "como".
> La justificacion de arquitectura de alto nivel esta en `PLAN_INGENIERIA.md` §3; aqui se concretan las decisiones de implementacion.

## Context

El sistema no existe todavia. Se construye desde cero un unico servicio web que expone una API REST, persiste en un motor relacional embebido y sirve una interfaz web sin paso de build. No hay sistemas legados que integrar ni datos que migrar: el punto de partida es un repositorio vacio con un plan de ingenieria aprobado y ocho capacidades especificadas.

Restricciones que condicionan el diseno:

- **Despliegue en una institucion sin equipo de plataforma:** un proceso Node, un archivo de base de datos, cero servicios externos.
- **El requisito critico es la exclusion mutua de franjas:** dos solicitudes concurrentes sobre la misma franja deben producir una sola reserva activa.
- **Trazabilidad evaluable:** cada requisito debe poder rastrearse hasta un escenario y una prueba automatizada.
- **Restricciones de tiempo del dominio:** el reloj de negocio debe ser inyectable para que las pruebas de anticipacion y de expiracion sean deterministas.

## Goals / Non-Goals

**Goals**

- Implementar las 8 capacidades especificadas con una correspondencia de una a uno entre requisito, caso de uso, endpoint y prueba.
- Garantizar la exclusion mutua de franjas en el motor de persistencia, no solo en la validacion de entrada.
- Mantener el dominio puro y testeable sin base de datos, con los adaptadores de infraestructura fuera del dominio.
- Ofrecer un contrato HTTP unico y consistente (formato de error, envelope de coleccion, codigos de error).
- Dejar la interfaz web como un cliente de la API, sin logica de negocio duplicada.

**Non-Goals (decisiones de diseno, no de alcance funcional)**

- No se implementa CQRS, event sourcing ni Hexagonal completo: el dominio es un CRUD transaccional y el coste de esa indireccion no se amortiza.
- No se implementa cache distribuida ni cola de mensajes: la unica necesidad asincrona es la bitacora, que se resuelve con un bus de eventos en memoria.
- No se implementa un ORM: el SQL se escribe a mano para que la condicion de solapamiento sea legible y auditable.
- No se implementa i18n, ni tema oscuro, ni navegacion por teclado: la UI es funcional y operativa, no un producto de consumo.

## Decisions

### D1 · Estructura de modulos y frontera de dependencias

**Decision.** Monolito modular con cuatro capas: `domain/` (reglas puras), `modules/<capacidad>/{domain,application}` (casos de uso y puertos), `db/` (adaptadores de persistencia), `http/` (adaptador de entrada). Las dependencias van en un solo sentido: `http -> application -> domain`. `db` implementa los puertos declarados en `application`.

**Alternativas consideradas.**

- *Capas horizontales globales* (`controllers/`, `services/`, `repositories/`): descartadas porque un cambio en la regla de solapamiento tocaria tres carpetas distintas y la regla de negocio quedaria partida en archivos sin relacion.
- *Modulos sin `domain/` separado*: descartada porque las reglas puras (solapamiento, duracion, transiciones) son justo lo que mas conviene poder probar sin base de datos, y son el corazon del sistema.

**Consecuencia.** Cada capacidad de la especificacion se corresponde con una carpeta en `src/modules/`. El nombre de la carpeta es el nombre de la capacidad en OpenSpec, lo que hace la trazabilidad visible en el arbol de archivos.

### D2 · Modelo temporal: fecha civil + hora local como cadenas

**Decision.** `fecha` se almacena como texto `YYYY-MM-DD`, `hora_inicio` y `hora_fin` como `HH:MM`. La duracion se calcula con una funcion pura `minutosEntre(horaInicio, horaFin)`.

**Alternativas consideradas.**

- *`TIMESTAMP` ISO con zona*: permite cruzar medianoche y comparar directamente, pero obliga a convertir en cada comparacion y hace la regla de "4 horas" menos legible. Ademas, el instante UTC de una reserva academnica no es un concepto natural para el usuario.
- *Columnas `INTEGER` de minutos desde medianoche*: mas eficiente, pero menos legible en la base de datos y mas fragil frente a datos mal formados.

**Consecuencia.** Las franjas son semiabiertas `[inicio, fin)`: la condicion de solapamiento es `a.hora_inicio < b.hora_fin AND a.hora_fin > b.hora_inicio`. Dos franjas que se tocan en un extremo no se solapan, lo que coincide con la especificacion.

### D3 · Exclusion mutua: transaccion `IMMEDIATE` + re-verificacion

**Decision.** La creacion de una reserva se ejecuta dentro de `db.transaction(fn).immediate(...)` de better-sqlite3, que abre la transaccion con `BEGIN IMMEDIATE` y por tanto toma el bloqueo de escritura de la base de datos desde el principio. Dentro de esa transaccion se ejecuta la consulta de solapamiento y, si no hay conflicto, la insercion. La verificacion y la insercion son inseparables.

**Alternativas consideradas.**

- *Verificar antes de abrir la transaccion*: descartada por ser la causa clasica de la condicion de carrera (dos peticiones verifican, las dos pasan, las dos insertan).
- *`INSERT ... WHERE NOT EXISTS`*: evita la ventana en SQLite, pero es mucho menos legible que la consulta explicita y no permite distinguir "no existe" de "error de base de datos" en el mensaje de error.
- *Restriccion `EXCLUDE` de PostgreSQL*: es la mejor solucion tecnica, pero exige un servidor de base de datos que el entorno de evaluacion no tiene. Se deja documentada como plan de contingencia.

**Consecuencia.** En un unico proceso Node, better-sqlite3 es sincrono: la transaccion completa se ejecuta sin ceder el event loop, de modo que no puede existir interleaving entre la verificacion y la insercion. La prueba de concurrencia usa `Promise.all` sobre peticiones HTTP reales para demostrarlo. Si el sistema se despliega en varias instancias, habria que migrar a PostgreSQL con `EXCLUDE USING gist`; el puerto `ReservationRepository` esta preparado para eso.

### D4 · Autenticacion: JWT con version de token, resuelta contra la base de datos

**Decision.** El token JWT contiene exclusivamente `sub` (identificador de usuario) y `tokenVersion`. En cada peticion, el middleware `authenticate` valida la firma y la expiracion, carga el usuario y su rol, y descarta el token si `tokenVersion` no coincide con la del usuario. Los permisos se resuelven de la base de datos en cada peticion.

**Alternativas consideradas.**

- *Embedder el rol en el token*: descartado en la revision de specs (H-02): un cambio de rol no surtiria efecto hasta la expiracion del token, contradiciendo el escenario de `rbac`.
- *Sesiones en servidor*: descartada porque obliga a un almacen de sesiones compartido y no aporta al objetivo del sistema.
- *Lista de revocados en base de datos*: descartada por complejidad; la version de token cubre el caso real (desactivacion, cambio de contrasena, cierre de sesion) con un unico entero por usuario.

**Consecuencia.** Cada peticion autenticada hace una consulta de usuario y rol. A la escala institucional (decenas de usuarios concurrentes) es irrelevante, y a cambio el control de permisos es siempre el vigente.

### D5 · Permisos: matriz `rol_permisos` normalizada, sembrada desde codigo

**Decision.** Las tablas `roles`, `permisos` y `rol_permisos` se pueban desde una constante de codigo (`src/db/semilla/roles.ts`) durante el sembrado. El middleware `authorize(permiso)` consulta si el rol del usuario posee el permiso.

**Alternativas consideradas.**

- *Permisos como enum en el usuario*: mas simple, pero no permite consultar ni auditar la matriz, y la especificacion de `rbac` exige exponerla.
- *Matriz editable por UI*: fuera de alcance en v1; el catalogo es de la institucion y no cambia con frecuencia. La tabla ya lo permite sin cambios de esquema.

**Consecuencia.** `GET /api/roles` y `GET /api/permisos` exponen la matriz. La separacion de funciones (el solicitante no aprueba su propia reserva) se implementa en el caso de uso, no como un permiso, porque depende de la relacion entre la reserva y el actor.

### D6 · Bitacora: bus de eventos en memoria y escritura dentro de la transaccion de negocio

**Decision.** Los casos de uso publican eventos de dominio (`ReservaCreada`, `ReservaAprobada`, ...) en un `EventBus` en memoria. Un suscriptor (`audit`) los persiste en la tabla `eventos`. El bus se invoca **dentro** de la transaccion de negocio, de modo que la bitacora y el cambio de estado se confirman o se revierten juntos.

**Alternativas consideradas.**

- *Escribir la bitacora explicitamente en cada caso de uso*: mas simple de entender, pero duplica la llamada en cada transicion y es facil olvidar un evento. El bus centraliza el punto de escritura.
- *Cola de trabajos asincrona*: overkill para este volumen y introduce el problema de consistencia entre la transaccion de negocio y la de auditoria.

**Consecuencia.** El patron es "publicar en el bus -> el suscriptor escribe". Como el bus es sincrono y se invoca dentro de la transaccion, si la escritura del evento falla, la transaccion completa falla.

### D7 · Formato de error unico y catalogo de codigos

**Decision.** Todo error de la API responde con la misma envoltura:

```json
{ "error": { "codigo": "ESPACIO_OCUPADO", "mensaje": "...", "detalles": [ { "campo": "fecha", "mensaje": "..." } ] } }
```

El codigo de error es parte del contrato (aparece en la especificacion). El mapeo HTTP es:

| Codigo | HTTP |
|---|---|
| `VALIDACION` | 422 |
| `NO_AUTENTICADO` | 401 |
| `CREDENCIALES_INVALIDAS` | 401 |
| `DEMASIADOS_INTENTOS` | 429 |
| `PERMISO_DENEGADO` | 403 |
| `AUTO_APROBACION_PROHIBIDA` | 403 |
| `NO_ENCONTRADO` / `*_NO_ENCONTRADO` | 404 |
| `*_DUPLICADO` | 409 |
| `ESPACIO_OCUPADO` | 409 |
| `ESTADO_INVALIDO` | 409 |
| `ESPACIO_INACTIVO` | 409 |
| `ESPACIO_CON_RESERVAS_ACTIVAS` | 409 |
| `ANTICIPACION_INSUFICIENTE` | 422 |
| `FUERA_DE_HORARIO` | 422 |
| `CAPACIDAD_EXCEDIDA` | 422 |
| `ROL_NO_PERMITIDO` | 422 |
| `ROL_DESCONOCIDO` | 422 |
| `TIPO_ESPACIO_DESCONOCIDO` | 422 |
| `AUTOMODIFICACION_PROHIBIDA` | 409 |

**Alternativas consideradas.**

- *Errores de Express por defecto*: exponen la traza interna y no son estables para el cliente.
- *Codigos HTTP sin cuerpo tipado*: el cliente tendria que interpretar el texto del mensaje. Un codigo estable permite que la UI y las pruebas asserten sobre el contrato.

### D8 · Reloj de negocio inyectable

**Decision.** El modulo `src/shared/reloj.ts` exporta `relojActual(): Date`. Toda la logica que dependa del "ahora" (validacion de anticipacion, expiracion, marcas de tiempo) lo consume a traves de un puerto `Reloj` inyectado en el contenedor. Las pruebas fijan un reloj de prueba.

**Alternativas consideradas.**

- *`new Date()` directo*: no determinista en las pruebas de anticipacion; una prueba que pasa hoy puede fallar manana.
- *Inyeccion por modulo de test (mock de `Date`)*: fragil con las librerias.

**Consecuencia.** El limite de intentos de login usa la misma abstraccion, lo que hace la prueba del bloqueo de 15 minutos determinista.

**Nota sobre la zona horaria.** El reloj del negocio representa una **hora civil local** (la misma que ve la persona usuaria en el calendario de la institucion), no un instante UTC. Las comparaciones de fecha usan `fechaCivil(instante)`, que extrae anio, mes y dia en hora local. Por eso el reloj de prueba se construye con el constructor local de `Date` y las horas de las reservas se interpretan tambien en hora local: de este modo las pruebas son identicas en cualquier zona horaria (riesgo R-09 del plan).

### D9 · Limite de intentos de login en memoria

**Decision.** Un servicio `LimitadorIntentos` mantiene un `Map<correo, { fallos: number, ventanaDesde: Date }>` en memoria del proceso. Al superar 5 fallos en 15 minutos devuelve `429 DEMASIADOS_INTENTOS`.

**Alternativas consideradas.**

- *Rate limiting externo (Redis)*: infraestructura que no existe en el entorno.
- *Bloqueo permanente de la cuenta*: permitiria un denegacion de servicio trivial contra cualquier correo conocido.

**Consecuencia.** El limite es por proceso: en un despliegue con varias instancias no seria global. Se acepta porque el despliegue institucional de referencia es una unica instancia (limitation L4 del plan). Se documenta como limitacion.

### D10 · Interfaz web sin framework

**Decision.** `public/` contiene `index.html`, `app.js` y `estilos.css`, servidos como estaticos por Express. La UI llama a la API con `fetch`, mantiene el token en `localStorage` y no contiene reglas de negocio: solo presenta datos y captura la entrada del usuario.

**Alternativas consideradas.**

- *React/Vite*: descartado en `PLAN_INGENIERIA.md` D-6 por el coste de un pipeline de build sin aporte al objetivo de trazabilidad.
- *Generar la UI desde la especificacion*: descartado por la complejidad de un generador de formularios que solo se usaria en 8 casos.

**Consecuencia.** La UI no es una copia de la API con logica: al no duplicar reglas, sirve de prueba de que el contrato HTTP es suficiente para consumir el sistema.

### D11 · Pruebas: base de datos en memoria por archivo de prueba

**Decision.** Cada archivo de prueba de integracion crea una base SQLite en memoria, ejecuta el esquema y el sembrado minimo, y construye la aplicacion Express con un contenedor propio. `supertest` ejerce la API sin abrir un puerto.

**Alternativas consideradas.**

- *Una base de datos compartida entre pruebas*: acopla los archivos de prueba entre si y produce fallos intermitentes.
- *Base de datos en disco por ejecucion*: mas lenta y deja residuos en el sistema de archivos.

**Consecuencia.** Las pruebas son aisladas y ejecutables en cualquier orden y en paralelo. La cobertura se mide con `@vitest/coverage-v8` con umbrales del 80 %.

### D12 · Estructura de la base de datos

**Decision.** Siete tablas. `usuarios` referencia `roles`; `rol_permisos` une `roles` y `permisos`; `espacios` es independiente; `reservas` referencia `espacios` y `usuarios` y referencia a si misma (`revisor_id`); `eventos` es append-only con referencia opcional.

Restricciones: `UNIQUE` en `usuarios.email` y `espacios.codigo`; `CHECK` en `hora_inicio < hora_fin`, `capacidad > 0` y `tipo IN (...)`; `ON DELETE RESTRICT` en las referencias de `reservas` para que un espacio o usuario con historial no se pueda borrar; `PRAGMA foreign_keys = ON` (SQLite lo tiene desactivado por defecto).

Indices: `reservas(espacio_id, fecha, estado)` para la consulta de disponibilidad y solapamiento, `reservas(usuario_id, fecha)` para el filtro por solicitante, `eventos(entidad_tipo, entidad_id)` para el historial, `eventos(creado_en)` para el rango de fechas de la auditoria.

**Alternativas consideradas.**

- *Columnas `TEXT` para el estado y el tipo*: descartadas por la ausencia de restriccion; un `CHECK` documenta el dominio en el propio motor y evita estados invalidos aun si una futura consulta mal formada llega a la base de datos.
- *Tabla `tipos_espacio`*: descartada por sobreingenieria para un catalogo fijo de cinco valores.

**Consecuencia.** La migracion se aplica desde `src/db/migrations/` de forma idempotente y se registra en `schema_migrations`, de modo que `npm run db:migrate` es seguro de reejecutar.

## Risks / Trade-offs

| Riesgo | Mitigacion |
|---|---|
| Un solo escritor en SQLite limita el rendimiento con mucha concurrencia | El perfil de uso real esta muy por debajo del limite; el puerto `ReservationRepository` permite migrar a PostgreSQL + `EXCLUDE` sin tocar el dominio. Registrado como R-04. |
| El limite de intentos de login es por proceso, no global | Se acepta en el despliegue de una instancia; documentado como limitacion. Migrar a un almacen compartido seria el siguiente paso si se despliega en varias instancias. |
| Resolver el rol en cada peticion anade una consulta por peticion | Coste despreciable a la escala institucional; a cambio el control de permisos es siempre el vigente (requisito de `rbac`). |
| El modelo temporal no soporta reservas que crucen medianoche | Declarado como limitacion L1. La validacion lo impide de forma explicita en lugar de producir datos inconsistentes. |
| La UI guarda el token en `localStorage`, expuesto ante XSS | Riesgo aceptado para una app interna sin contenido dinamico de terceros. Mitigacion: no se inserta HTML desde el servidor, todas las inserciones en el DOM usan `textContent`. |
| La base de datos es un archivo unico: la perdida de ese archivo es la perdida del sistema | `PRAGMA journal_mode = WAL` y `synchronous = FULL`, script `npm run db:backup` y `PRAGMA integrity_check` en el health-check. Registrado como R-07. |
| El modelo de eventos en memoria pierde eventos si el proceso muere entre la confirmacion del negocio y la escritura del evento | Se mitiga escribiendo el evento **dentro** de la misma transaccion de negocio, de modo que no existe ese intervalo. |

## Migration Plan

No hay migracion de datos: es un sistema nuevo. La puesta en marcha es:

1. `npm ci` (instalacion reproducible con lockfile).
2. `cp .env.example .env` y ajustar `JWT_SECRET` y `DATABASE_URL`.
3. `npm run db:migrate` (crea el esquema; idempotente).
4. `npm run db:seed` (carga roles, permisos, usuarios de ejemplo y espacios de ejemplo).
5. `npm run dev` (servidor de desarrollo) o `npm run build && npm start` (produccion).

**Reversa:** el estado del sistema reside íntegramente en el archivo SQLite. La reversa consiste en detener el proceso, restaurar la copia de respaldo produced por `npm run db:backup` y volver a arrancar. No hay migraciones de esquema destructivas en la v1.

## Open Questions

Ninguna pendiente que afecte a las especificaciones, al enfoque o al desglose de tareas. Las decisiones diferidas de forma consciente (notificaciones por correo, integracion con calendarios externos, autenticacion corporativa, sede multiples) estan declaradas fuera de alcance en `PLAN_INGENIERIA.md` §1.4 y no requieren resolucion para esta entrega.
