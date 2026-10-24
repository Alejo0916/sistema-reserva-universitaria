# Tasks

> Plan de trabajo derivado de `specs/**/spec.md` (que) y `design.md` (como).
> Cada tarea indica como se verifica su cumplimiento. El orden respeta las dependencias del grafo del plan de ingenieria (§4.3).
> Cada grupo entrega sus propias pruebas y su propia documentacion: no se aplaza el testing al final.

## 1. Cimientos del sistema (E1)

- [ ] 1.1 Crear el modulo de configuracion (`src/shared/config.ts`) leyendo las variables de entorno con valores por defecto y validando las obligatorias. Verificacion: `npm test` incluye una prueba que falla ante una variable invalida y pasa con valores validos.
- [ ] 1.2 Implementar el reloj de negocio inyectable (`src/shared/reloj.ts`) con puerto `Reloj` y una implementacion de reloj real. Verificacion: prueba unitaria que fija un reloj de prueba y comprueba el valor devuelto.
- [ ] 1.3 Implementar el catalogo de errores de dominio (`src/domain/errores.ts`) con `ErrorDominio` que transporta codigo, estado HTTP y detalles, mas la fabrica de codigos por defecto. Verificacion: prueba unitaria que comprueba el codigo, el estado y la forma de los detalles de cada familia de error.
- [ ] 1.4 Implementar las reglas puras de tiempo (`src/domain/tiempo.ts`): `aMinutos`, `minutosEntre`, `formatearHora`, `esFechaValida`, `esFechaPasada`, `solapan`, `fusionarIntervalos`. Verificacion: pruebas unitarias que cubren el borde de las 00:00, la duracion de 15 minutos, las franjas contiguas y la interseccion parcial.
- [ ] 1.5 Escribir el esquema SQL (`src/db/schema.sql`) con las siete tablas, sus restricciones `CHECK` y `UNIQUE`, los indices y los `ON DELETE RESTRICT`. Verificacion: prueba que aplica el esquema en una base en memoria y comprueba que un `CHECK` invalido es rechazado por el motor.
- [ ] 1.6 Implementar la conexion (`src/db/conexion.ts`) con `PRAGMA foreign_keys = ON`, `journal_mode = WAL` y `synchronous = FULL`, y el aplicador de migraciones idempotente con registro en `schema_migrations`. Verificacion: `npm run db:migrate` dos veces seguidas no produce error ni duplica el esquema.
- [ ] 1.7 Implementar el bus de eventos en memoria (`src/shared/eventBus.ts`) con `emitir` y `suscribir`. Verificacion: prueba unitaria que comprueba el orden de entrega y que un suscriptor que lanza una excepcion propaga el error.
- [ ] 1.8 Implementar el contenedor de dependencias (`src/container.ts`) que cablea base de datos, repositorios, bus y casos de uso, y construir la aplicacion Express (`src/app.ts`) con el manejador centralizado de errores y el endpoint `GET /api/health`. Verificacion: prueba de integracion que responde `200` con el estado de la base de datos.
- [ ] 1.9 Configurar ESLint, TypeScript estricto y Vitest, y documentar el comando de verificacion en `README.md`. Verificacion: `npm run typecheck`, `npm run lint` y `npm test` terminan con codigo de salida 0.

## 2. Identidad: autenticacion, usuarios y RBAC (E2)

- [ ] 2.1 Crear el esquema de roles y permisos (`src/db/semilla/roles.ts`) con los cuatro roles, los diez permisos y su matriz, y el sembrado de la base. Verificacion: prueba que consulta la matriz sembrada y comprueba exactamente los permisos de cada rol.
- [ ] 2.2 Implementar el repositorio de usuarios y el de roles, con `buscarPorCorreo`, `buscarPorId`, `listar` con filtros y paginacion, y `crear` que devuelve `409` ante correo duplicado. Verificacion: pruebas de integracion de repositorio con base en memoria.
- [ ] 2.3 Implementar el hash de contrasenas con bcrypt y el servicio de tokens JWT que emite un token con `sub` y `tokenVersion` unicamente, y verifica firma, expiracion y version. Verificacion: prueba unitaria que decodifica el token y comprueba que no contiene rol ni permisos.
- [ ] 2.4 Implementar el caso de uso de registro publico que asigna siempre el rol `ESTUDIANTE` y rechaza con `422 ROL_NO_PERMITIDO` cualquier otro rol. Verificacion: prueba de integracion `POST /api/auth/registro` que cubre los escenarios de registro valido, autoasignacion de `ADMIN`, correo duplicado y contrasena insegura.
- [ ] 2.5 Implementar el limitador de intentos de inicio de sesion (5 fallos en 15 minutos) con el reloj inyectado. Verificacion: prueba unitaria que comprueba el bloqueo, el expiracion de la ventana y que el bloqueo no afecta a otros correos.
- [ ] 2.6 Implementar los middlewares `authenticate` y `authorize(permiso)` con resolucion del rol desde la base de datos en cada peticion. Verificacion: prueba de integracion que comprueba `401` sin token, `401` con token invalido o expirado, `401` con token revocado por desactivacion, y `403` por permiso insuficiente.
- [ ] 2.7 Implementar los casos de uso de login, perfil y cierre de sesion, incrementando `tokenVersion` en el cierre. Verificacion: prueba de integracion del flujo completo de sesion, incluida la invalidacion del token tras el cierre y el registro del evento `LOGIN_FALLIDO`.
- [ ] 2.8 Implementar el caso de uso de alta de usuario por administrador con validacion de rol y correo unico, y el de actualizacion con la proteccion `AUTOMODIFICACION_PROHIBIDA` para el rol y la auto-desactivacion. Verificacion: pruebas de integracion de los escenarios de `user-management`.
- [ ] 2.9 Implementar el caso de uso de desactivacion de usuario, la conservacion de su historial y el restablecimiento de contrasena. Verificacion: prueba de integracion que comprueba que la reserva de un usuario desactivado sigue mostrando su nombre en el historial.
- [ ] 2.10 Exponer `GET /api/roles` y `GET /api/permisos` y documentar la matriz de permisos en `README.md`. Verificacion: prueba de integracion del contrato y revision del README.

## 3. Catalogo de espacios academicos (E3)

- [ ] 3.1 Implementar el repositorio de espacios con el filtro por tipo y estado, la busqueda por identificador o codigo y la restriccion de unicidad del codigo. Verificacion: pruebas de integracion de repositorio.
- [ ] 3.2 Implementar los casos de uso de alta, actualizacion, activacion y desactivacion, incluyendo el bloqueo `ESPACIO_CON_RESERVAS_ACTIVAS`. Verificacion: prueba de integracion de los escenarios de `space-management`, incluido el de consultar por codigo.
- [ ] 3.3 Exponer los endpoints de espacios con validacion Zod de la entrada y el envelope `{ datos, total, pagina, limite }`. Verificacion: prueba de integracion del envelope y de los filtros por tipo y estado.
- [ ] 3.4 Documentar el contrato de espacios y el significado de cada tipo de espacio en `README.md`. Verificacion: revision del README contra la especificacion.

## 4. Disponibilidad (E4)

- [ ] 4.1 Implementar el caso de uso que lista las franjas ocupadas de un espacio y fecha, filtrando por estados `PENDIENTE` y `APROBADA` y ordenando por hora de inicio. Verificacion: prueba de integracion con orden, con reserva terminal excluida y con espacio inexistente.
- [ ] 4.2 Implementar el calculo de franjas libres restando las ocupadas a la franja de apertura y cierre, uniendo los segmentos contiguos. Verificacion: pruebas unitarias e integracion del dia libre, del dia con reserva intermedia, con reservas contiguas y del dia completamente ocupado.
- [ ] 4.3 Exponer `GET /api/espacios/:id/disponibilidad` con validacion de la fecha y el codigo `ESPACIO_INACTIVO`. Verificacion: prueba de integracion de los escenarios de `availability`, incluidas las fechas invalidas.

## 5. Ciclo de vida de la reserva (E5)

- [ ] 5.1 Implementar el repositorio de reservas con el filtro de solapamiento (`hora_inicio < otra.hora_fin AND hora_fin > otra.hora_inicio`), los filtros de listado y el envelope de coleccion. Verificacion: pruebas de integracion de repositorio con solapamiento total, parcial, contenido y franjas contiguas.
- [ ] 5.2 Implementar la validacion de la solicitud en el orden fijado por la especificacion: espacio, coherencia de franja y fecha, anticipacion, horario del espacio, asistentes y disponibilidad. Verificacion: prueba unitaria por regla y prueba de integracion que comprueba que el primer error incumplido es el que se devuelve.
- [ ] 5.3 Implementar el caso de uso de creacion de reserva dentro de una transaccion `IMMEDIATE` que verifique y persista de forma inseparables. Verificacion: prueba de concurrencia con `Promise.all` sobre la misma franja que comprueba un `201`, un `409` y una sola fila en la base de datos.
- [ ] 5.4 Implementar los casos de uso de consulta de detalle y de listado, restringiendo el alcance a las reservas propias para `DOCENTE` y `ESTUDIANTE`. Verificacion: prueba de integracion de los escenarios de alcance y de los filtros.
- [ ] 5.5 Implementar el caso de uso de cancelacion, restringido al solicitante o a quien tenga `reservas:aprobar`, con validacion del estado y registro del evento. Verificacion: prueba de integracion de los escenarios de cancelacion, incluido el de la franja liberada que puede reutilizarse.
- [ ] 5.6 Implementar los casos de uso de aprobacion y rechazo con la separacion de funciones, el motivo obligatorio en el rechazo y la verificacion del espacio activo. Verificacion: prueba de integracion de los seis escenarios de `reservation-approval`.
- [ ] 5.7 Exponer los endpoints de reservas con validacion Zod y documentar el contrato completo en `README.md`. Verificacion: revision del README contra la especificacion y prueba de integracion del contrato.

## 6. Bitacora e historial (E6)

- [ ] 6.1 Implementar el repositorio de eventos con insercion append-only y consultas por entidad, por tipo y por rango de fechas. Verificacion: prueba de integracion del append-only y de los tres filtros.
- [ ] 6.2 Conectar el suscriptor de auditoria al bus de eventos para registrar todos los eventos de dominio dentro de la transaccion de negocio. Verificacion: prueba de integracion que comprueba que un fallo de escritura del evento revierte la operacion de negocio.
- [ ] 6.3 Exponer `GET /api/reservas/:id/historial` y `GET /api/eventos` con el permiso `auditoria:leer`. Verificacion: prueba de integracion de los escenarios de `reservation-history`, incluido el `403` para un estudiante.
- [ ] 6.4 Implementar la interfaz web operativa en `public/` con inicio de sesion, catalogo de espacios, consulta de disponibilidad, formulario de solicitud, cola de aprobaciones, historial y panel de auditoria, sin duplicar reglas de negocio. Verificacion: la UI consume unicamente los endpoints documentados y funciona contra el servidor en ejecucion.

## 7. Trazabilidad y cierre de la etapa de implementacion

- [ ] 7.1 Construir `docs/TRAZABILIDAD.md` con la matriz requisito, escenario, prueba automatizada y archivo de implementacion para los 44 requisitos. Verificacion: cada fila referencia un test existente y cada test existe en la suite.
- [ ] 7.2 Ejecutar `npm run verify` (typecheck + lint + tests + validacion OpenSpec) y dejar constancia del resultado. Verificacion: la cadena completa termina con codigo de salida 0.
- [ ] 7.3 Medir la cobertura y alcanzar al menos el 80 % en lineas, funciones, ramas y sentencias, con cobertura de rama del 100 % en las reglas criticas de solapamiento, duracion y transiciones. Verificacion: `npm run test:coverage` sin fallos de umbral.

## Workflow follow-up

- Archivar el change con `openspec archive add-core-reservation-system --yes` una vez completadas las tareas 1 a 7, de modo que los deltas se fusionen en `openspec/specs/**` y quede el registro historico en `openspec/changes/archive/`.
- Verificar el resultado archivado con `openspec validate --strict` y `openspec list --specs`.
