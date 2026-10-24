# availability Specification

## Purpose
Permite consultar la disponibilidad de un espacio academico en una fecha determinada, mostrando que franjas estan ocupadas, con que estado y por quien, y que franjas quedan libres dentro del horario de funcionamiento del espacio.

## Requirements

### Requirement: Consulta de franjas ocupadas
El sistema SHALL devolver, para un espacio y una fecha, la lista de franjas reservadas con estado `PENDIENTE` o `APROBADA`, indicando hora de inicio, hora de fin, estado, identificador de la reserva y nombre del solicitante. SHALL ordenar las franjas por hora de inicio. SHALL exigir el permiso `espacios:leer`. SHALL responder `200`.

#### Scenario: Espacio con una reserva activa
- **WHEN** se consulta la disponibilidad de un espacio con una reserva aprobada de 10:00 a 12:00 en la fecha indicada
- **THEN** la API responde `200` con una franja ocupada de 10:00 a 12:00, estado `APROBADA` y el nombre del solicitante

#### Scenario: Las reservas no activas no ocupan
- **WHEN** se consulta la disponibilidad de un espacio con una reserva rechazada de 10:00 a 12:00
- **THEN** la API responde `200` con la lista de franjas ocupadas vacia

#### Scenario: Orden de las franjas
- **WHEN** se consulta la disponibilidad de un espacio con reservas a las 14:00 y a las 09:00
- **THEN** la respuesta `200` lista primero la franja de las 09:00 y despues la de las 14:00

#### Scenario: Espacio inexistente
- **WHEN** se consulta la disponibilidad de un espacio que no existe
- **THEN** la API responde `404` con el codigo de error `ESPACIO_NO_ENCONTRADO`

### Requirement: Calculo de franjas libres
El sistema SHALL calcular las franjas libres del espacio dentro de su horario de funcionamiento, restando a la franja de apertura y cierre las franjas ocupadas. Las franjas libres SHALL ser contiguas y no SHALL solaparse entre si. SHALL responder `200` con la lista de franjas libres.

#### Scenario: Dia sin reservas
- **WHEN** se consulta la disponibilidad de un espacio con horario de 08:00 a 22:00 y ninguna reserva
- **THEN** la API responde `200` con una unica franja libre de 08:00 a 22:00

#### Scenario: Dia con una reserva intermedia
- **WHEN** se consulta la disponibilidad de un espacio con horario de 08:00 a 22:00 y una reserva de 10:00 a 12:00
- **THEN** la API responde `200` con dos franjas libres: de 08:00 a 10:00 y de 12:00 a 22:00

#### Scenario: Franjas libres contiguas entre reservas
- **WHEN** se consulta la disponibilidad de un espacio con reservas de 09:00 a 10:00 y de 10:00 a 11:00
- **THEN** la API responde `200` con las franjas libres de 08:00 a 09:00 y de 11:00 a 22:00
- **AND** ninguna franja libre incluye las horas de 09:00 a 11:00

#### Scenario: Dia completamente ocupado
- **WHEN** se consulta la disponibilidad de un espacio con horario de 08:00 a 12:00 y una reserva de 08:00 a 12:00
- **THEN** la API responde `200` con la lista de franjas libres vacia

### Requirement: Espacio inactivo no reservable
El sistema SHALL responder `409` con el codigo `ESPACIO_INACTIVO` cuando se consulta la disponibilidad de un espacio inactivo, para dejar claro que no admite nuevas reservas.

#### Scenario: Consulta sobre un espacio inactivo
- **WHEN** se consulta la disponibilidad de un espacio con estado inactivo
- **THEN** la API responde `409` con el codigo de error `ESPACIO_INACTIVO`

### Requirement: Validacion de la fecha consultada
El sistema SHALL exigir una fecha con formato `YYYY-MM-DD` y SHALL responder `422` con el codigo `VALIDACION` si el formato es incorrecto o si la fecha no existe en el calendario.

#### Scenario: Fecha con formato invalido
- **WHEN** se consulta la disponibilidad indicando la fecha "15-01-2026"
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle del parametro `fecha`

#### Scenario: Fecha que no existe en el calendario
- **WHEN** se consulta la disponibilidad indicando la fecha "2026-02-30"
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle del parametro `fecha`
