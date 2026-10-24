# Spec Delta

## Purpose

Permite auditar el ciclo de vida de las reservas y de las operaciones administrativas mediante una bitacora append-only de eventos, que registra quien hizo cada accion, cuando y con que resultado, y que puede consultarse por reserva o de forma global.

## ADDED Requirements

### Requirement: Registro de eventos en la bitacora
El sistema SHALL registrar en una bitacora append-only todo evento de dominio relevante: creacion, aprobacion, rechazo y cancelacion de reservas, alta, actualizacion y desactivacion de usuarios, alta, actualizacion y desactivacion de espacios, e intentos de inicio de sesion fallidos. Cada evento SHALL incluir tipo, fecha y hora de ocurrencia, actor cuando exista, entidad afectada y detalle.

#### Scenario: Traza completa de una reserva
- **WHEN** una reserva se crea, se aprueba y luego se cancela
- **THEN** la bitacora registra tres eventos en ese orden: `RESERVA_CREADA`, `RESERVA_APROBADA` y `RESERVA_CANCELADA`

#### Scenario: Registro del motivo de rechazo
- **WHEN** una reserva se rechaza con un motivo
- **THEN** el evento `RESERVA_RECHAZADA` incluye el motivo en su detalle

#### Scenario: La bitacora es de solo insercion
- **WHEN** se consulta la bitacora de una reserva
- **THEN** todos los eventos devueltos siguen existiendo con su contenido original y en orden cronologico

### Requirement: Historial de una reserva
El sistema SHALL devolver el historial de eventos de una reserva existente, en orden cronologico. SHALL exigir el permiso `reservas:leer` y SHALL restringirse a las reservas visibles para el rol del solicitante. SHALL responder `404` con el codigo `RESERVA_NO_ENCONTRADA` si la reserva no existe o no es visible.

#### Scenario: Historial de una reserva propia
- **WHEN** el solicitante consulta el historial de su reserva
- **THEN** la API responde `200` con la secuencia de eventos de esa reserva

#### Scenario: Historial de una reserva ajena no visible para el rol
- **WHEN** un estudiante consulta el historial de una reserva creada por otra persona
- **THEN** la API responde `404` con el codigo de error `RESERVA_NO_ENCONTRADA`

### Requirement: Consulta global de auditoria
El sistema SHALL permitir consultar la bitacora global con filtros opcionales por tipo de evento, por entidad afectada y por rango de fechas. SHALL exigir el permiso `auditoria:leer` y SHALL responder `403` con el codigo `PERMISO_DENEGADO` cuando el usuario no lo posea.

#### Scenario: Consulta global por administrador
- **WHEN** un administrador consulta la bitacora global
- **THEN** la API responde `200` con los eventos registrados, con su tipo, actor, entidad y fecha

#### Scenario: Filtro por tipo de evento
- **WHEN** un administrador consulta la bitacora filtrando por el tipo `RESERVA_RECHAZADA`
- **THEN** la respuesta `200` contiene unicamente eventos de ese tipo

#### Scenario: Consulta sin permiso de auditoria
- **WHEN** un coordinador consulta la bitacora global
- **THEN** la API responde `200` con los eventos, porque su rol incluye el permiso `auditoria:leer`

#### Scenario: Consulta por un rol sin permiso
- **WHEN** un estudiante consulta la bitacora global
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`

### Requirement: Resumen del estado actual de una reserva
El sistema SHALL exponer en la consulta del detalle de una reserva su estado actual y el ultimo actor que la modifico, de modo que el historial y el estado sean consistentes entre si.

#### Scenario: Coherencia entre estado e historial
- **WHEN** se consulta el detalle y el historial de una reserva rechazada
- **THEN** el detalle informa el estado `RECHAZADA` y el historial termina en un evento `RESERVA_RECHAZADA`
