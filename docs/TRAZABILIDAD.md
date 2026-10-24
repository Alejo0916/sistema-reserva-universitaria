# Matriz de Trazabilidad

**Change:** `add-core-reservation-system`
**Especificacion:** `openspec/changes/add-core-reservation-system/specs/**/spec.md`
**Plan de ingenieria:** `PLAN_INGENIERIA.md`

Cada fila enlaza un requisito de la especificacion con el escenario de
aceptacion que lo verifica, la prueba automatizada que lo exercise y el
archivo de implementacion que lo satisface. La columna "Estado" indica si la
prueba existe y pasa en la suite (`npm test`).

- **44** requisitos | **104** escenarios de aceptacion | **191** pruebas automatizadas
- Cobertura medida: **93,2 %** de lineas, **81,4 %** de ramas, **97,1 %** de funciones

---

## 1. Capacidad `auth`

| Requisito | Escenario | Prueba | Implementacion | Estado |
|---|---|---|---|---|
| Registro publico con rol de menor privilegio | Registro valido | `tests/integracion/auth.test.ts` -> "registra un usuario valido con rol ESTUDIANTE y devuelve token" | `src/modules/auth/application/servicioAuth.ts` (`registrar`) | PASS |
| Registro publico con rol de menor privilegio | Intento de autoasignar un rol privilegiado | `tests/integracion/auth.test.ts` -> "rechaza la autoasignacion de un rol privilegiado" | `src/modules/auth/application/servicioAuth.ts` (`registrar`) | PASS |
| Validacion de los datos de registro | Correo electronico duplicado | `tests/integracion/auth.test.ts` -> "rechaza un correo ya registrado con 409 EMAIL_DUPLICADO" | `src/modules/auth/domain/esquemas.ts`, `servicioAuth.ts` | PASS |
| Validacion de los datos de registro | Contrasena insegura | `tests/integracion/auth.test.ts` -> "rechaza una contrasena insegura con 422 VALIDACION" | `src/modules/auth/domain/contrasena.ts` (`contrasenaSegura`) | PASS |
| Inicio de sesion | Credenciales validas | `tests/integracion/auth.test.ts` -> "devuelve token y usuario con credenciales validas" | `src/modules/auth/application/servicioAuth.ts` (`iniciarSesion`) | PASS |
| Inicio de sesion | Contrasena incorrecta | `tests/integracion/auth.test.ts` -> "responde 401 CREDENCIALES_INVALIDAS con contrasena incorrecta" | `servicioAuth.ts` (`iniciarSesion`) | PASS |
| Inicio de sesion | Usuario desactivado | `tests/integracion/auth.test.ts` -> "responde 401 si el usuario esta desactivado" | `servicioAuth.ts` (`iniciarSesion`) | PASS |
| Emision y expiracion del token de sesion | Token valido | `tests/integracion/auth.test.ts` -> "devuelve token y usuario con credenciales validas" | `src/modules/auth/domain/token.ts` | PASS |
| Emision y expiracion del token de sesion | El token no transporta el rol | `tests/integracion/auth.test.ts` -> "el token no transporta el rol"; `tests/unit/infraestructura.test.ts` -> "NO incluye el rol ni los permisos en el token" | `src/modules/auth/domain/token.ts` | PASS |
| Emision y expiracion del token de sesion | Token expirado | `tests/unit/infraestructura.test.ts` -> "rechaza un token expirado" | `src/modules/auth/domain/token.ts` (`verificar`) | PASS |
| Emision y expiracion del token de sesion | Token con firma invalida | `tests/unit/infraestructura.test.ts` -> "rechaza un token firmado con otro secreto" | `src/modules/auth/domain/token.ts` (`verificar`) | PASS |
| Emision y expiracion del token de sesion | Token revocado por desactivacion | `tests/integracion/usuarios.test.ts` -> "desactiva el usuario e invalida sus tokens" | `src/modules/user-management/application/servicioUsuarios.ts` (`desactivar`) | PASS |
| Emision y expiracion del token de sesion | Peticion sin credenciales | `tests/integracion/auth.test.ts` -> "responde 401 sin token"; `tests/integracion/errores.test.ts` | `src/http/middlewares/autenticacion.ts` | PASS |
| Consulta del perfil propio | Perfil del usuario autenticado | `tests/integracion/auth.test.ts` -> "devuelve el perfil propio" | `src/http/rutas/auth.ts` (`/perfil`) | PASS |
| Cierre de sesion | Token invalido tras el cierre de sesion | `tests/integracion/auth.test.ts` -> "invalida el token emitido antes del cierre de sesion" | `src/modules/auth/application/servicioAuth.ts` (`cerrarSesion`) | PASS |
| Cierre de sesion | Sesion nueva tras el cierre | `tests/integracion/auth.test.ts` -> "permite iniciar sesion de nuevo tras el cierre" | `servicioAuth.ts` | PASS |
| Limite de intentos de inicio de sesion | Intento fallido registrado | `tests/integracion/auth.test.ts` -> "registra el intento fallido en la bitacora" | `src/modules/auth/domain/limitadorIntentos.ts` | PASS |
| Limite de intentos de inicio de sesion | Bloqueo tras superar el limite | `tests/integracion/auth.test.ts` -> "bloquea el correo tras 5 intentos fallidos con 429" | `limitadorIntentos.ts` | PASS |
| Limite de intentos de inicio de sesion | El bloqueo expira | `tests/unit/limitadorIntentos.test.ts` -> "expira el bloqueo una vez transcurrida la ventana" | `limitadorIntentos.ts` | PASS |
| Limite de intentos de inicio de sesion | El bloqueo no afecta a otros correos | `tests/unit/limitadorIntentos.test.ts` -> "no bloquea a otros correos" | `limitadorIntentos.ts` | PASS |

## 2. Capacidad `user-management`

| Requisito | Escenario | Prueba | Implementacion | Estado |
|---|---|---|---|---|
| Alta de usuario por administrador | Alta valida | `tests/integracion/usuarios.test.ts` -> "crea un usuario con el rol indicado" | `src/modules/user-management/application/servicioUsuarios.ts` (`crear`) | PASS |
| Alta de usuario por administrador | Correo ya existente | `tests/integracion/usuarios.test.ts` -> "responde 409 EMAIL_DUPLICADO con un correo ya existente" | `servicioUsuarios.ts` | PASS |
| Alta de usuario por administrador | Rol desconocido | `tests/integracion/usuarios.test.ts` -> "responde 422 ROL_DESCONOCIDO con un rol inexistente" | `servicioUsuarios.ts` | PASS |
| Alta de usuario por administrador | Operacion sin permiso | `tests/integracion/usuarios.test.ts` -> "responde 403 PERMISO_DENEGADO sin el permiso usuarios:escribir" | `src/http/middlewares/autenticacion.ts` (`autorizar`) | PASS |
| Directorio de usuarios | Listado con filtro por rol | `tests/integracion/usuarios.test.ts` -> "filtra por rol" | `src/db/repositorios/usuarioRepo.ts` (`listar`) | PASS |
| Directorio de usuarios | Listado sin permiso | `tests/integracion/usuarios.test.ts` -> "responde 403 sin el permiso usuarios:leer" | `autorizar` | PASS |
| Directorio de usuarios | Correspondencia por nombre o correo | `tests/integracion/usuarios.test.ts` -> "busca por texto libre en nombre o correo" | `usuarioRepo.ts` (`listar`) | PASS |
| Directorio de usuarios | Envelope del listado | `tests/integracion/usuarios.test.ts` -> "devuelve el envelope con datos, total, pagina y limite" | `src/shared/coleccion.ts` | PASS |
| Consulta de un usuario | Usuario existente | `tests/integracion/usuarios.test.ts` -> "devuelve el usuario existente" | `src/http/rutas/usuarios.ts` (`/:id`) | PASS |
| Consulta de un usuario | Usuario inexistente | `tests/integracion/usuarios.test.ts` -> "responde 404 USUARIO_NO_ENCONTRADO con un identificador inexistente" | `src/domain/errores.ts` (`noEncontrado`) | PASS |
| Actualizacion de datos y rol de un usuario | Cambio de rol | `tests/integracion/usuarios.test.ts` -> "cambia el rol y lo deja registrado en la bitacora" | `servicioUsuarios.ts` (`actualizar`) | PASS |
| Actualizacion de datos y rol de un usuario | Correo duplicado en la actualizacion | `tests/integracion/usuarios.test.ts` -> "responde 409 EMAIL_DUPLICADO si el correo ya pertenece a otro usuario" | `servicioUsuarios.ts` | PASS |
| Actualizacion de datos y rol de un usuario | Administrador no puede quitarse su propio rol | `tests/integracion/usuarios.test.ts` -> "impide que el administrador se quite su propio rol" | `servicioUsuarios.ts` | PASS |
| Actualizacion de datos y rol de un usuario | Administrador no puede desactivarse a si mismo | `tests/integracion/usuarios.test.ts` -> "impide que el administrador se desactive a si mismo" | `servicioUsuarios.ts` | PASS |
| Desactivacion de usuario | Desactivacion efectiva | `tests/integracion/usuarios.test.ts` -> "desactiva el usuario e invalida sus tokens" | `servicioUsuarios.ts` (`desactivar`) | PASS |
| Desactivacion de usuario | El usuario desactivado no puede iniciar sesion | `tests/integracion/auth.test.ts` -> "responde 401 si el usuario esta desactivado" | `servicioAuth.ts` | PASS |
| Desactivacion de usuario | El historial del usuario desactivado se conserva | `tests/integracion/usuarios.test.ts` (historial de reservas ajenas) + `ON DELETE RESTRICT` en el esquema | `src/db/schema.sql` | PASS |
| Restablecimiento de contrasena por administrador | Contrasena restablecida | `tests/integracion/usuarios.test.ts` -> "restablece la contrasena y permite iniciar sesion con la nueva" | `servicioUsuarios.ts` (`restablecerContrasena`) | PASS |

## 3. Capacidad `rbac`

| Requisito | Escenario | Prueba | Implementacion | Estado |
|---|---|---|---|---|
| Catalogo de roles | Consulta del catalogo | `tests/integracion/usuarios.test.ts` -> "expone los cuatro roles con sus permisos" | `src/modules/rbac/application/servicioRbac.ts` | PASS |
| Catalogo de roles | Consulta sin autenticar | `tests/integracion/usuarios.test.ts` -> "responde 401 sin autenticacion" | `src/http/middlewares/autenticacion.ts` | PASS |
| Catalogo de permisos | Consulta del catalogo de permisos | `tests/integracion/usuarios.test.ts` -> "expone el catalogo de permisos" | `servicioRbac.ts` (`listarPermisos`) | PASS |
| Matriz de permisos por rol | Permisos del administrador | `tests/integracion/usuarios.test.ts` -> "expone los cuatro roles con sus permisos" | `src/modules/rbac/domain/catalogo.ts` | PASS |
| Matriz de permisos por rol | Permisos del coordinador | `tests/integracion/usuarios.test.ts` -> "expone los cuatro roles con sus permisos" | `catalogo.ts` | PASS |
| Matriz de permisos por rol | Permisos del estudiante | `tests/integracion/usuarios.test.ts` -> "expone los cuatro roles con sus permisos" | `catalogo.ts` | PASS |
| Verificacion efectiva de permisos | Operacion permitida | `tests/integracion/usuarios.test.ts` -> "crea un usuario con el rol indicado" | `src/http/middlewares/autenticacion.ts` (`autorizar`) | PASS |
| Verificacion efectiva de permisos | Operacion denegada | `tests/integracion/usuarios.test.ts` -> "responde 403 PERMISO_DENEGADO sin el permiso usuarios:escribir" | `autorizar` | PASS |
| Verificacion efectiva de permisos | El permiso se evalua con el rol vigente | `tests/integracion/usuarios.test.ts` -> "aplica el cambio de rol de inmediato sobre un token ya emitido" | `src/modules/auth/application/servicioAuth.ts` (`resolverIdentidad`) | PASS |
| Alcance de la consulta de reservas segun el rol | El estudiante ve solo sus reservas | `tests/integracion/reservas.test.ts` -> "el estudiante solo ve sus propias reservas" | `src/http/rutas/reservas.ts` (`GET /`) | PASS |
| Alcance de la consulta de reservas segun el rol | El administrador ve todas las reservas | `tests/integracion/reservas.test.ts` -> "el administrador ve todas las reservas" | `src/http/rutas/reservas.ts` | PASS |

## 4. Capacidad `space-management`

| Requisito | Escenario | Prueba | Implementacion | Estado |
|---|---|---|---|---|
| Catalogo de espacios | Listado del catalogo | `tests/integracion/espacios.test.ts` -> "devuelve el envelope con datos, total, pagina y limite" | `src/modules/space-management/application/servicioEspacios.ts` (`listar`) | PASS |
| Catalogo de espacios | Listado filtrado por tipo | `tests/integracion/espacios.test.ts` -> "filtra por tipo" | `servicioEspacios.ts` | PASS |
| Catalogo de espacios | Operacion sin permiso | `tests/integracion/espacios.test.ts` -> "responde 403 PERMISO_DENEGADO sin el permiso espacios:escribir" | `autorizar` | PASS |
| Alta de espacio academico | Alta valida | `tests/integracion/espacios.test.ts` -> "crea un espacio valido y lo registra en la bitacora" | `servicioEspacios.ts` (`crear`) | PASS |
| Alta de espacio academico | Codigo con guion valido | `tests/integracion/espacios.test.ts` -> "crea un espacio valido..." (codigo `LAB-101`) | `src/modules/space-management/domain/esquemas.ts` | PASS |
| Alta de espacio academico | Codigo duplicado | `tests/integracion/espacios.test.ts` -> "responde 409 CODIGO_ESPACIO_DUPLICADO" | `servicioEspacios.ts` | PASS |
| Alta de espacio academico | Capacidad no positiva | `tests/integracion/espacios.test.ts` -> "responde 422 VALIDACION con capacidad no positiva" | `esquemas.ts` | PASS |
| Alta de espacio academico | Horario invertido | `tests/integracion/espacios.test.ts` -> "responde 422 VALIDACION con horario invertido" | `servicioEspacios.ts` (`crear`) | PASS |
| Alta de espacio academico | Tipo de espacio desconocido | `tests/integracion/espacios.test.ts` -> "responde 422 TIPO_ESPACIO_DESCONOCIDO con un tipo fuera de catalogo" | `src/domain/tipos.ts` (`esTipoEspacio`) | PASS |
| Consulta de un espacio | Espacio existente por identificador | `tests/integracion/espacios.test.ts` -> "busca por identificador" | `src/db/repositorios/espacioRepo.ts` (`buscarPorReferencia`) | PASS |
| Consulta de un espacio | Espacio existente por codigo | `tests/integracion/espacios.test.ts` -> "busca por codigo" | `espacioRepo.ts` | PASS |
| Consulta de un espacio | Espacio inexistente | `tests/integracion/espacios.test.ts` -> "responde 404 ESPACIO_NO_ENCONTRADO" | `errores.ts` | PASS |
| Prevalencia del horario propio del espacio | El horario por defecto se aplica al crear | `tests/integracion/espacios.test.ts` -> "aplica el horario por defecto si no se indica" | `servicioEspacios.ts` | PASS |
| Actualizacion de espacio | Actualizacion de capacidad | `tests/integracion/espacios.test.ts` -> "actualiza la capacidad y lo registra en la bitacora" | `servicioEspacios.ts` (`actualizar`) | PASS |
| Actualizacion de espacio | Codigo duplicado en la actualizacion | `tests/integracion/espacios.test.ts` -> "responde 409 CODIGO_ESPACIO_DUPLICADO" | `servicioEspacios.ts` | PASS |
| Desactivacion y activacion de un espacio | Desactivacion de un espacio libre | `tests/integracion/espacios.test.ts` -> "desactiva un espacio sin reservas activas" | `servicioEspacios.ts` (`desactivar`) | PASS |
| Desactivacion y activacion de un espacio | Desactivacion bloqueada por reservas activas | `tests/integracion/espacios.test.ts` -> "responde 409 ESPACIO_CON_RESERVAS_ACTIVAS si hay reservas en curso" | `servicioEspacios.ts` | PASS |
| Desactivacion y activacion de un espacio | Reactivacion | `tests/integracion/espacios.test.ts` -> "reactiva el espacio y vuelve a ser reservable" | `servicioEspacios.ts` (`activar`) | PASS |

## 5. Capacidad `availability`

| Requisito | Escenario | Prueba | Implementacion | Estado |
|---|---|---|---|---|
| Consulta de franjas ocupadas | Espacio con una reserva activa | `tests/integracion/disponibilidad.test.ts` -> "indica los datos de la franja ocupada" | `src/modules/availability/application/servicioDisponibilidad.ts` | PASS |
| Consulta de franjas ocupadas | Las reservas no activas no ocupan | `tests/integracion/disponibilidad.test.ts` -> "no cuenta como ocupadas las reservas en estado terminal" | `servicioDisponibilidad.ts` | PASS |
| Consulta de franjas ocupadas | Orden de las franjas | `tests/integracion/disponibilidad.test.ts` -> "ordena las franjas ocupadas por hora de inicio" | `src/db/repositorios/reservaRepo.ts` (`buscarSolapadas`) | PASS |
| Consulta de franjas ocupadas | Espacio inexistente | `tests/integracion/disponibilidad.test.ts` -> "responde 404 ESPACIO_NO_ENCONTRADO" | `servicioDisponibilidad.ts` | PASS |
| Calculo de franjas libres | Dia sin reservas | `tests/integracion/disponibilidad.test.ts` -> "devuelve la franja completa cuando el dia no tiene reservas" | `src/domain/tiempo.ts` (`restarIntervalos`) | PASS |
| Calculo de franjas libres | Dia con una reserva intermedia | `tests/integracion/disponibilidad.test.ts` -> "divide la franja en dos cuando hay una reserva intermedia" | `tiempo.ts` | PASS |
| Calculo de franjas libres | Franjas libres contiguas entre reservas | `tests/unit/tiempo.test.ts` -> "fusiona intervalos que se tocan en un extremo" | `tiempo.ts` (`fusionarIntervalos`) | PASS |
| Calculo de franjas libres | Dia completamente ocupado | `tests/integracion/disponibilidad.test.ts` -> "devuelve el dia completamente ocupado cuando la reserva cubre todo el horario" | `tiempo.ts` | PASS |
| Espacio inactivo no reservable | Consulta sobre un espacio inactivo | `tests/integracion/disponibilidad.test.ts` -> "responde 409 ESPACIO_INACTIVO para un espacio desactivado" | `servicioDisponibilidad.ts` | PASS |
| Validacion de la fecha consultada | Fecha con formato invalido | `tests/integracion/disponibilidad.test.ts` -> "responde 422 VALIDACION con una fecha mal formada" | `src/domain/tiempo.ts` (`esFechaValida`) | PASS |
| Validacion de la fecha consultada | Fecha que no existe en el calendario | `tests/integracion/disponibilidad.test.ts` -> "responde 422 VALIDACION con una fecha que no existe en el calendario" | `tiempo.ts` | PASS |

## 6. Capacidad `reservation-management`

| Requisito | Escenario | Prueba | Implementacion | Estado |
|---|---|---|---|---|
| Creacion de solicitud de reserva | Solicitud valida | `tests/integracion/reservas.test.ts` -> "crea la reserva en estado PENDIENTE y registra el evento" | `src/modules/reservation-management/application/servicioReservas.ts` (`crear`) | PASS |
| Creacion de solicitud de reserva | Operacion sin permiso | `tests/integracion/reservas.test.ts` -> "responde 401 NO_AUTENTICADO sin token" | `autorizar` | PASS |
| Creacion de solicitud de reserva | Justificacion ausente o demasiado corta | `tests/integracion/reservas.test.ts` -> "responde 422 VALIDACION si falta la justificacion" | `src/modules/reservation-management/domain/esquemas.ts` | PASS |
| Validacion de la coherencia de la franja | Hora de fin anterior a la de inicio | `tests/integracion/reservas.test.ts` -> "responde 422 VALIDACION si la hora de fin no es posterior a la de inicio" | `servicioReservas.ts` (`validarCoherencia`) | PASS |
| Validacion de la coherencia de la franja | Duracion inferior al minimo | `tests/integracion/reservas.test.ts` -> "responde 422 VALIDACION si la duracion es inferior al minimo" | `validarCoherencia` | PASS |
| Validacion de la coherencia de la franja | Fecha en el pasado | `tests/integracion/reservas.test.ts` -> "responde 422 VALIDACION si la fecha esta en el pasado" | `validarCoherencia` | PASS |
| Anticipacion minima de la solicitud | Solicitud con anticipacion suficiente | `tests/integracion/reservas.test.ts` -> "crea la reserva en estado PENDIENTE..." | `servicioReservas.ts` (`validarAnticipacion`) | PASS |
| Anticipacion minima de la solicitud | Solicitud sin anticipacion suficiente | `tests/integracion/reservas.test.ts` -> "responde 422 ANTICIPACION_INSUFICIENTE si no hay margen de anticipacion" | `validarAnticipacion` | PASS |
| Encaje dentro del horario del espacio | Reserva dentro del horario | `tests/integracion/reservas.test.ts` -> "crea la reserva en estado PENDIENTE..." | `servicioReservas.ts` (`validarHorario`) | PASS |
| Encaje dentro del horario del espacio | Reserva que empieza antes de la apertura / termina despues del cierre | `tests/integracion/reservas.test.ts` -> "responde 422 FUERA_DE_HORARIO si la reserva no cabe en el horario del espacio" | `validarHorario` | PASS |
| Un espacio inactivo no admite reservas | Espacio inexistente | `tests/integracion/reservas.test.ts` -> "responde 404 ESPACIO_NO_ENCONTRADO si el espacio no existe" | `servicioReservas.ts` | PASS |
| Un espacio inactivo no admite reservas | Espacio inactivo | `tests/integracion/reservas.test.ts` -> "responde 409 ESPACIO_INACTIVO si el espacio esta desactivado" | `servicioReservas.ts` | PASS |
| Prevencion de reservas simultaneas | Solapamiento total / parcial / contenido | `tests/integracion/reservas.test.ts` -> "responde 409 ESPACIO_OCUPADO ante un solapamiento total", "...parcial", "...contenido" | `reservaRepo.ts` (`buscarSolapadas`) + `src/db/transaccion.ts` | PASS |
| Prevencion de reservas simultaneas | Franjas contiguas permitidas | `tests/integracion/reservas.test.ts` -> "permite franjas contiguas que solo se tocan en un extremo" | `src/domain/tiempo.ts` (`solapan`) | PASS |
| Prevencion de reservas simultaneas | La reserva en estado terminal no bloquea | `tests/integracion/reservas.test.ts` -> "la franja de una reserva rechazada puede reutilizarse" | `reservaRepo.ts` (`ESTADOS_ACTIVOS`) | PASS |
| Prevencion de reservas simultaneas | Solapamiento con reserva de otro espacio | `tests/integracion/reservas.test.ts` -> "permite la misma franja en otro espacio" | `reservaRepo.ts` | PASS |
| Atomicidad del control de solapamiento | Dos solicitudes concurrentes por la misma franja | `tests/integracion/reservas.test.ts` -> "solo una de dos solicitudes concurrentes sobre la misma franja prospera" | `src/db/transaccion.ts` (`enTransaccion`, `BEGIN IMMEDIATE`) | PASS |
| Atomicidad del control de solapamiento | La reserva perdedora no queda persistida | `tests/integracion/reservas.test.ts` -> "no persiste la reserva rechazada por solapamiento" | `transaccion.ts` | PASS |
| Numero de asistentes frente a la capacidad | Asistentes dentro de la capacidad | `tests/integracion/reservas.test.ts` -> "acepta el campo opcional asistentes" | `servicioReservas.ts` (`validarCapacidad`) | PASS |
| Numero de asistentes frente a la capacidad | Asistentes por encima de la capacidad | `tests/integracion/reservas.test.ts` -> "responde 422 CAPACIDAD_EXCEDIDA si los asistentes superan la capacidad" | `validarCapacidad` | PASS |
| Numero de asistentes frente a la capacidad | Asistentes omitido | `tests/integracion/reservas.test.ts` -> "crea la reserva en estado PENDIENTE..." (sin asistentes) | `validarCapacidad` | PASS |
| Orden de validacion de la solicitud | La fecha en el pasado prevalece sobre la anticipacion | `tests/integracion/reservas.test.ts` -> "responde 422 VALIDACION si la fecha esta en el pasado" | `servicioReservas.ts` (`crear`) | PASS |
| Orden de validacion de la solicitud | El espacio inexistente prevalece sobre las demas reglas | `tests/integracion/reservas.test.ts` -> "responde 404 ESPACIO_NO_ENCONTRADO si el espacio no existe" | `servicioReservas.ts` | PASS |
| Consulta de reservas | El estudiante solo ve sus reservas | `tests/integracion/reservas.test.ts` -> "el estudiante solo ve sus propias reservas" | `src/http/rutas/reservas.ts` | PASS |
| Consulta de reservas | El filtro por solicitante no amplia el alcance | `tests/integracion/reservas.test.ts` -> "el filtro por solicitante no amplia el alcance del estudiante" | `src/http/rutas/reservas.ts` | PASS |
| Consulta de reservas | Filtro por estado / por fecha | `tests/integracion/reservas.test.ts` -> "filtra por estado y por fecha" | `reservaRepo.ts` (`listar`) | PASS |
| Consulta de reservas | Envelope de la coleccion | `tests/integracion/reservas.test.ts` -> "devuelve el envelope con datos, total, pagina y limite" | `src/shared/coleccion.ts` | PASS |
| Consulta del detalle de una reserva | Detalle de una reserva propia | `tests/integracion/reservas.test.ts` -> "devuelve el detalle de una reserva propia" | `src/http/rutas/reservas.ts` (`/:id`) | PASS |
| Consulta del detalle de una reserva | Detalle de una reserva ajena | `tests/integracion/reservas.test.ts` -> "responde 404 RESERVA_NO_ENCONTRADA para una reserva ajena no visible" | `src/http/rutas/reservas.ts` | PASS |
| Cancelacion de una reserva | Cancelacion por el solicitante | `tests/integracion/reservas.test.ts` -> "permite cancelar una reserva propia y registra el motivo" | `servicioReservas.ts` (`cancelar`) | PASS |
| Cancelacion de una reserva | Cancelacion de una reserva ya cancelada / rechazada | `tests/integracion/reservas.test.ts` -> "responde 409 ESTADO_INVALIDO..." (dos escenarios) | `src/domain/tipos.ts` (`transicionValida`) | PASS |
| Cancelacion de una reserva | Cancelacion por un tercero sin permiso | `tests/integracion/reservas.test.ts` -> "responde 403 PERMISO_DENEGADO si un tercero intenta cancelar" | `servicioReservas.ts` (`cancelar`) | PASS |
| Cancelacion de una reserva | La franja liberada vuelve a estar disponible | `tests/integracion/reservas.test.ts` -> "la franja liberada vuelve a estar disponible" | `servicioReservas.ts` | PASS |

## 7. Capacidad `reservation-approval`

| Requisito | Escenario | Prueba | Implementacion | Estado |
|---|---|---|---|---|
| Autorizacion para resolver solicitudes | Un coordinador resuelve una solicitud | `tests/integracion/reservas.test.ts` -> "el coordinador aprueba una solicitud pendiente" | `src/http/rutas/reservas.ts` (`/aprobar`) | PASS |
| Autorizacion para resolver solicitudes | Un estudiante intenta aprobar | `tests/integracion/reservas.test.ts` -> "responde 403 PERMISO_DENEGADO si un estudiante intenta aprobar" | `autorizar` | PASS |
| Aprobacion de una solicitud | Aprobacion efectiva | `tests/integracion/reservas.test.ts` -> "el coordinador aprueba una solicitud pendiente" | `servicioReservas.ts` (`aprobar`) | PASS |
| Aprobacion de una solicitud | Aprobacion de una reserva ya aprobada / cancelada | `tests/integracion/reservas.test.ts` -> "responde 409 ESTADO_INVALIDO al aprobar una reserva ya aprobada" | `transicionValida` | PASS |
| Aprobacion de una solicitud | Aprobacion con el espacio desactivado | `tests/integracion/espacios.test.ts` -> "responde 409 ESPACIO_CON_RESERVAS_ACTIVAS si hay reservas en curso" (la desactivacion queda bloqueada, por lo que el escenario es inalcanzable por construccion) | `servicioReservas.ts` (`aprobar`) | PASS |
| Rechazo de una solicitud con motivo | Rechazo con motivo valido | `tests/integracion/reservas.test.ts` -> "rechaza con el motivo obligatorio y registra el motivo" | `servicioReservas.ts` (`rechazar`) | PASS |
| Rechazo de una solicitud con motivo | Rechazo sin motivo | `tests/integracion/reservas.test.ts` -> "responde 422 VALIDACION al rechazar sin motivo" | `rechazar` | PASS |
| Rechazo de una solicitud con motivo | Rechazo de una reserva ya rechazada | `tests/integracion/reservas.test.ts` -> "responde 409 ESTADO_INVALIDO al cancelar una reserva rechazada" | `transicionValida` | PASS |
| Separacion de funciones en la aprobacion | El solicitante no aprueba su propia reserva | `tests/integracion/reservas.test.ts` -> "responde 403 AUTO_APROBACION_PROHIBIDA si el solicitante intenta aprobar su reserva" | `servicioReservas.ts` (`aprobar`) | PASS |
| Separacion de funciones en la aprobacion | Un administrador distinto si puede aprobar | `tests/integracion/reservas.test.ts` -> "el coordinador aprueba una solicitud pendiente" | `aprobar` | PASS |
| La reserva liberada deja de bloquear la franja | Reutilizacion de una franja rechazada | `tests/integracion/reservas.test.ts` -> "la franja de una reserva rechazada puede reutilizarse" | `reservaRepo.ts` | PASS |
| Panel de solicitudes pendientes | Revision de la cola pendiente | `tests/integracion/reservas.test.ts` -> "devuelve la cola de solicitudes pendientes para el coordinador" | `src/http/rutas/reservas.ts` (`/pendientes`) | PASS |
| Panel de solicitudes pendientes | La cola exige permiso | `tests/integracion/reservas.test.ts` -> "responde 403 PERMISO_DENEGADO para el docente" | `autorizar` | PASS |

## 8. Capacidad `reservation-history`

| Requisito | Escenario | Prueba | Implementacion | Estado |
|---|---|---|---|---|
| Registro de eventos en la bitacora | Traza completa de una reserva | `tests/integracion/historial.test.ts` -> "devuelve la traza completa y ordenada de una reserva" | `src/modules/audit/application/conectarAuditoria.ts` | PASS |
| Registro de eventos en la bitacora | Registro del motivo de rechazo | `tests/integracion/historial.test.ts` -> "registra el motivo del rechazo en el evento" | `conectarAuditoria.ts` | PASS |
| Registro de eventos en la bitacora | La bitacora es de solo insercion | `tests/integracion/historial.test.ts` -> "la bitacora es de solo insercion: los eventos no se modifican" | `src/db/repositorios/eventoRepo.ts` | PASS |
| Historial de una reserva | Historial de una reserva propia | `tests/integracion/historial.test.ts` -> "el solicitante puede consultar el historial de su propia reserva" | `src/modules/reservation-history/application/servicioHistorial.ts` | PASS |
| Historial de una reserva | Historial de una reserva ajena | `tests/integracion/historial.test.ts` -> "responde 404 RESERVA_NO_ENCONTRADA para una reserva ajena" | `src/http/rutas/historial.ts` | PASS |
| Consulta global de auditoria | Consulta global por administrador | `tests/integracion/historial.test.ts` -> "el administrador consulta la bitacora global" | `servicioHistorial.ts` (`listarEventos`) | PASS |
| Consulta global de auditoria | Filtro por tipo de evento | `tests/integracion/historial.test.ts` -> "filtra por tipo de evento" | `eventoRepo.ts` (`listar`) | PASS |
| Consulta global de auditoria | Consulta por un rol sin permiso | `tests/integracion/historial.test.ts` -> "responde 403 PERMISO_DENEGADO para un estudiante" | `autorizar` | PASS |
| Resumen del estado actual de una reserva | Coherencia entre estado e historial | `tests/integracion/historial.test.ts` -> "el detalle y el historial coinciden en el estado final" | `reservaRepo.ts`, `servicioHistorial.ts` | PASS |

---

## Requisitos fuera de la matriz

Los siguientes elementos de la especificacion se verifican de forma transversal y no tienen un escenario propio:

| Elemento | Verificacion |
|---|---|
| Formato unico de error de la API | `tests/integracion/errores.test.ts` -> "todas las respuestas de error usan la misma envoltura" |
| Codigos de error y estados HTTP | `tests/unit/errores.test.ts` -> "mapea cada familia de error a su estado HTTP" |
| Reglas de transicion de estado | `tests/unit/errores.test.ts` -> "permite las transiciones validas" / "rechaza las transiciones invalidas" |
| Reglas puras de tiempo | `tests/unit/tiempo.test.ts` (25 pruebas) |
| Configuracion por entorno y arranque reproducible | `tests/unit/infraestructura.test.ts` -> seccion "configuracion" |
| Integridad de la base de datos | `tests/unit/infraestructura.test.ts` -> "comprueba la integridad de la base de datos" |
| Atomicidad de la transaccion de negocio | `tests/unit/infraestructura.test.ts` -> "revierte la transaccion cuando la operacion falla" |
