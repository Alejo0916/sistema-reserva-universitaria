# Spec Delta

## Purpose

Permite que los coordinadores y administradores resuelvan las solicitudes de reserva, aprobando las que cumplen las politicas de la institucion o rechazandolas con un motivo justificado, dejando constancia del actor y del motivo en la bitacora.

## ADDED Requirements

### Requirement: Autorizacion para resolver solicitudes
El sistema SHALL exigir el permiso `reservas:aprobar` para aprobar o rechazar una solicitud. SHALL responder `403` con el codigo `PERMISO_DENEGADO` cuando el usuario autenticado no lo posea, y no SHALL modificar el estado de la reserva.

#### Scenario: Un coordinador resuelve una solicitud
- **WHEN** un coordinador con el permiso `reservas:aprobar` aprueba una reserva pendiente
- **THEN** la API responde `200` con la reserva en estado `APROBADA`

#### Scenario: Un estudiante intenta aprobar
- **WHEN** un estudiante intenta aprobar una reserva pendiente
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`
- **AND** la reserva conserva el estado `PENDIENTE`

### Requirement: Aprobacion de una solicitud
El sistema SHALL cambiar el estado de una reserva `PENDIENTE` a `APROBADA` al aprobarla, registrando el actor, la fecha de la decision y un evento `RESERVA_APROBADA` en la bitacora. SHALL verificar antes que el espacio siga activo y que la franja no haya sido ocupada por otra reserva activa.

#### Scenario: Aprobacion efectiva
- **WHEN** un administrador aprueba una reserva pendiente de un espacio activo
- **THEN** la API responde `200` con la reserva en estado `APROBADA` y con el identificador de quien la aprobo
- **AND** la bitacora registra un evento `RESERVA_APROBADA`

#### Scenario: Aprobacion de una reserva ya aprobada
- **WHEN** se aprueba una reserva que ya esta en estado `APROBADA`
- **THEN** la API responde `409` con el codigo de error `ESTADO_INVALIDO`

#### Scenario: Aprobacion de una reserva cancelada
- **WHEN** se aprueba una reserva en estado `CANCELADA`
- **THEN** la API responde `409` con el codigo de error `ESTADO_INVALIDO`

#### Scenario: Aprobacion con el espacio desactivado
- **WHEN** se aprueba una reserva pendiente cuyo espacio fue desactivado
- **THEN** la API responde `409` con el codigo de error `ESPACIO_INACTIVO`

### Requirement: Rechazo de una solicitud con motivo
El sistema SHALL cambiar el estado de una reserva `PENDIENTE` a `RECHAZADA` al rechazarla, exigiendo un motivo de entre 10 y 500 caracteres, y registrando el actor, el motivo y un evento `RESERVA_RECHAZADA` en la bitacora. SHALL responder `422` con el codigo `VALIDACION` si el motivo falta o es demasiado corto.

#### Scenario: Rechazo con motivo valido
- **WHEN** un coordinador rechaza una reserva pendiente con el motivo "El laboratorio estara en mantenimiento ese dia"
- **THEN** la API responde `200` con la reserva en estado `RECHAZADA` y con el motivo registrado
- **AND** la bitacora registra un evento `RESERVA_RECHAZADA` con el motivo

#### Scenario: Rechazo sin motivo
- **WHEN** un coordinador rechaza una reserva sin indicar motivo
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle del campo `motivo`
- **AND** la reserva conserva el estado `PENDIENTE`

#### Scenario: Rechazo de una reserva ya rechazada
- **WHEN** se rechaza una reserva en estado `RECHAZADA`
- **THEN** la API responde `409` con el codigo de error `ESTADO_INVALIDO`

### Requirement: Separacion de funciones en la aprobacion
El sistema SHALL impedir que la persona que creo una solicitud la apruebe o la rechace. SHALL responder `403` con el codigo `AUTO_APROBACION_PROHIBIDA` en ese caso.

#### Scenario: El solicitante no aprueba su propia reserva
- **WHEN** un coordinador que creo la reserva intenta aprobarla
- **THEN** la API responde `403` con el codigo de error `AUTO_APROBACION_PROHIBIDA`
- **AND** la reserva conserva el estado `PENDIENTE`

#### Scenario: Un administrador distinto si puede aprobar
- **WHEN** un administrador que no creo la reserva la aprueba
- **THEN** la API responde `200` con la reserva en estado `APROBADA`

### Requirement: La reserva liberada deja de bloquear la franja
El sistema SHALL considerar que una reserva en estado `RECHAZADA` o `CANCELADA` ya no ocupa la franja horaria, de modo que la misma franja pueda solicitarse de nuevo. SHALL registrar en la bitacora el evento de la transicion correspondiente.

#### Scenario: Reutilizacion de una franja rechazada
- **WHEN** una reserva de 10:00 a 12:00 es rechazada y un usuario solicita esa misma franja
- **THEN** la API responde `201` con la nueva reserva en estado `PENDIENTE`

### Requirement: Panel de solicitudes pendientes
El sistema SHALL listar las solicitudes en estado `PENDIENTE` de forma filtrable por espacio y por fecha. Los roles `ADMIN` y `COORDINADOR` SHALL obtener la lista completa y los demas roles SHALL obtener `403` con el codigo `PERMISO_DENEGADO`.

#### Scenario: Revision de la cola pendiente
- **WHEN** un coordinador lista las solicitudes pendientes de una fecha concreta
- **THEN** la API responde `200` con las solicitudes pendientes de esa fecha, cada una con su espacio, franja y solicitante

#### Scenario: La cola exige permiso
- **WHEN** un docente lista las solicitudes pendientes
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`
