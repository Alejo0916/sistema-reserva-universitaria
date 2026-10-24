# space-management Specification

## Purpose
Permite administrar el catalogo de espacios academicos de la institucion (laboratorios, auditorios, salas de computo y salas de seminarios), incluyendo su identificacion, clasificacion, capacidad, ubicacion, horario de funcionamiento y estado de disponibilidad para reservas.

## Requirements

### Requirement: Catalogo de espacios
El sistema SHALL mantener el catalogo de espacios academicos con los atributos codigo, nombre, tipo, descripcion, capacidad, edificio, piso, horario de apertura, horario de cierre y estado activo. SHALL listar los espacios con filtros opcionales por tipo y por estado activo. SHALL exigir el permiso `espacios:leer`. SHALL responder `200` con el envelope `{ datos, total, pagina, limite }`.

#### Scenario: Listado del catalogo
- **WHEN** un usuario autenticado lista los espacios
- **THEN** la API responde `200` con los espacios del catalogo, cada uno con su codigo, nombre, tipo, capacidad y estado activo
- **AND** la respuesta incluye las claves `datos`, `total`, `pagina` y `limite`

#### Scenario: Listado filtrado por tipo
- **WHEN** un usuario autenticado lista los espacios filtrando por tipo `LABORATORIO`
- **THEN** la API responde `200` unicamente con espacios de tipo `LABORATORIO`

#### Scenario: Operacion sin permiso
- **WHEN** un usuario sin el permiso `espacios:leer` intenta listar los espacios
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`

### Requirement: Alta de espacio academico
El sistema SHALL permitir crear un espacio con el permiso `espacios:escribir`. SHALL validar que el codigo sea unico y que tenga entre 3 y 20 caracteres formados por letras mayusculas, digitos o guiones, que el nombre tenga entre 3 y 120 caracteres, que la capacidad sea un entero mayor que cero y que el horario de apertura sea anterior al horario de cierre. SHALL registrar en la bitacora un evento `ESPACIO_CREADO`.

#### Scenario: Alta valida
- **WHEN** un administrador crea el espacio con codigo "LAB-101", nombre "Laboratorio de Quimica", tipo `LABORATORIO`, capacidad 24 y horario de 08:00 a 22:00
- **THEN** la API responde `201` con el espacio creado y activo
- **AND** la bitacora registra un evento `ESPACIO_CREADO`

#### Scenario: Codigo con guion valido
- **WHEN** un administrador crea un espacio con codigo "AUD-MAIN"
- **THEN** la API responde `201` con el espacio creado

#### Scenario: Codigo duplicado
- **WHEN** se intenta crear un espacio con un codigo ya existente
- **THEN** la API responde `409` con el codigo de error `CODIGO_ESPACIO_DUPLICADO`

#### Scenario: Capacidad no positiva
- **WHEN** se intenta crear un espacio con capacidad cero o negativa
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle del campo `capacidad`

#### Scenario: Horario invertido
- **WHEN** se intenta crear un espacio con horario de apertura posterior al de cierre
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle de los campos de horario

#### Scenario: Tipo de espacio desconocido
- **WHEN** se intenta crear un espacio con un tipo fuera del catalogo
- **THEN** la API responde `422` con el codigo de error `TIPO_ESPACIO_DESCONOCIDO`

### Requirement: Consulta de un espacio
El sistema SHALL devolver el detalle de un espacio existente. La consulta `GET /api/espacios/:referencia` SHALL aceptar tanto el identificador numerico como el codigo alfanumerico del espacio. SHALL responder `404` con el codigo `ESPACIO_NO_ENCONTRADO` si no existe.

#### Scenario: Espacio existente por identificador
- **WHEN** un usuario autenticado solicita el detalle de un espacio existente usando su identificador
- **THEN** la API responde `200` con todos los atributos del espacio

#### Scenario: Espacio existente por codigo
- **WHEN** un usuario autenticado solicita el detalle de un espacio existente usando su codigo
- **THEN** la API responde `200` con todos los atributos del espacio

#### Scenario: Espacio inexistente
- **WHEN** se solicita un espacio con una referencia que no existe
- **THEN** la API responde `404` con el codigo de error `ESPACIO_NO_ENCONTRADO`

### Requirement: Prevalencia del horario propio del espacio
El sistema SHALL usar el horario de apertura y cierre definido en cada espacio para validar las reservas de ese espacio. El horario por defecto del sistema SHALL aplicarse unicamente como valor inicial al crear un espacio. SHALL permitir que un espacio tenga un horario propio distinto del de los demas.

#### Scenario: Cada espacio tiene su propio horario
- **WHEN** se consultan dos espacios con horarios de apertura distintos y ambos tienen reservas validas
- **THEN** cada espacio valida las reservas contra su propio horario

#### Scenario: El horario por defecto se aplica al crear
- **WHEN** un administrador crea un espacio sin indicar horario
- **THEN** la API responde `201` con el espacio usando el horario por defecto configurado

### Requirement: Actualizacion de espacio
El sistema SHALL permitir actualizar los atributos editables de un espacio con el permiso `espacios:escribir`. SHALL rechazar un codigo duplicado con `409` y un horario invertido con `422`. SHALL registrar en la bitacora un evento `ESPACIO_ACTUALIZADO`.

#### Scenario: Actualizacion de capacidad
- **WHEN** un administrador cambia la capacidad de un espacio de 24 a 30
- **THEN** la API responde `200` con el espacio ya actualizado
- **AND** la bitacora registra un evento `ESPACIO_ACTUALIZADO`

#### Scenario: Codigo duplicado en la actualizacion
- **WHEN** se cambia el codigo de un espacio al de otro espacio existente
- **THEN** la API responde `409` con el codigo de error `CODIGO_ESPACIO_DUPLICADO`

### Requirement: Desactivacion y activacion de un espacio
El sistema SHALL permitir desactivar un espacio para retirarlo de las reservas nuevas sin perder su historial, y SHALL permitir reactivarlo. SHALL responder `409` con el codigo `ESPACIO_CON_RESERVAS_ACTIVAS` al desactivar un espacio que tenga reservas en estado `PENDIENTE` o `APROBADA`.

#### Scenario: Desactivacion de un espacio libre
- **WHEN** un administrador desactiva un espacio sin reservas activas
- **THEN** la API responde `200` con el espacio en estado inactivo

#### Scenario: Desactivacion bloqueada por reservas activas
- **WHEN** un administrador desactiva un espacio que tiene una reserva en estado `APROBADA`
- **THEN** la API responde `409` con el codigo de error `ESPACIO_CON_RESERVAS_ACTIVAS`
- **AND** el espacio permanece activo

#### Scenario: Reactivacion
- **WHEN** un administrador reactiva un espacio previamente inactivo
- **THEN** la API responde `200` con el espacio en estado activo y vuelve a ser reservable
