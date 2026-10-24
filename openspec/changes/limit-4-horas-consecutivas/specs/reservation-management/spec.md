# Spec Delta

## MODIFIED Requirements

### Requirement: Validacion de la coherencia de la franja
El sistema SHALL rechazar con `422` una reserva cuya hora de inicio no sea anterior a su hora de fin, cuya duracion sea inferior a 15 minutos, cuya duracion sea superior a 240 minutos, cuya fecha no exista en el calendario o cuya fecha ya haya pasado. SHALL usar la fecha de referencia del sistema para determinar el dia actual.

#### Scenario: Hora de fin anterior a la de inicio
- **WHEN** se intenta crear una reserva de 12:00 a 10:00
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle de los campos de hora

#### Scenario: Duracion inferior al minimo
- **WHEN** se intenta crear una reserva de 10:00 a 10:10
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle del campo de duracion

#### Scenario: Duracion superior al maximo
- **WHEN** se intenta crear una reserva de 10:00 a 14:30
- **THEN** la API responde `422` con el codigo de error `DURACION_EXCEDIDA`
- **AND** no se persiste ninguna reserva

#### Scenario: Duracion exactamente en el maximo
- **WHEN** se intenta crear una reserva de 10:00 a 14:00
- **THEN** la API responde `201`

#### Scenario: Fecha en el pasado
- **WHEN** se intenta crear una reserva con una fecha anterior al dia actual
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle del campo `fecha`
- **AND** no se persiste ninguna reserva

## ADDED Requirements

### Requirement: Limite de duracion por reserva
El sistema SHALL limitar la duracion de una reserva individual a 240 minutos (4 horas). SHALL responder `422` con el codigo de error `DURACION_EXCEDIDA` e indicar en el detalle la duracion solicitada y el maximo permitido cuando la duracion supere ese limite. SHALL omitir la persistencia de la reserva.

#### Scenario: Reserva de exactamente cuatro horas
- **WHEN** un usuario crea una reserva de 09:00 a 13:00
- **THEN** la API responde `201` con la reserva creada

#### Scenario: Reserva de mas de cuatro horas
- **WHEN** un usuario crea una reserva de 09:00 a 13:01
- **THEN** la API responde `422` con el codigo de error `DURACION_EXCEDIDA`
- **AND** el detalle indica la duracion solicitada y el maximo de 240 minutos
- **AND** no se persiste ninguna reserva

#### Scenario: Reserva de ocho horas en un espacio con horario amplio
- **WHEN** un usuario crea una reserva de 08:00 a 16:00 en un espacio que funciona de 08:00 a 22:00
- **THEN** la API responde `422` con el codigo de error `DURACION_EXCEDIDA`

#### Scenario: El limite se aplica con independencia del espacio
- **WHEN** un usuario crea una reserva de 10:00 a 15:00 en un segundo espacio distinto del primero
- **THEN** la API responde `422` con el codigo de error `DURACION_EXCEDIDA`

### Requirement: Limite de horas consecutivas del usuario
El sistema SHALL impedir que una misma persona acumule un bloque continuo de reservas superior a 240 minutos en una misma fecha. SHALL responder `422` con el codigo de error `HORAS_CONSECUTIVAS_EXCEDIDAS` e indicar en el detalle el bloque continuo conflictivo cuando lo supere.

#### Scenario: Dos reservas contiguas que suman cuatro horas
- **WHEN** un usuario ya tiene una reserva de 09:00 a 11:00 y crea otra de 11:00 a 13:00 en la misma fecha
- **THEN** la API responde `201` con la nueva reserva

#### Scenario: Dos reservas contiguas que suman mas de cuatro horas
- **WHEN** un usuario ya tiene una reserva de 09:00 a 11:00 y crea otra de 11:00 a 14:00 en la misma fecha
- **THEN** la API responde `422` con el codigo de error `HORAS_CONSECUTIVAS_EXCEDIDAS`
- **AND** el detalle indica el bloque continuo de 09:00 a 14:00
- **AND** no se persiste ninguna reserva

#### Scenario: Dos solicitudes concurrentes del mismo usuario sobre franjas contiguas
- **WHEN** un usuario envia dos solicitudes concurrentes de 09:00 a 11:00 y de 11:00 a 13:00 en la misma fecha y espacio
- **THEN** como maximo una de las dos prospera con `201` y la otra recibe `422` con el codigo de error `HORAS_CONSECUTIVAS_EXCEDIDAS`

### Requirement: Alcance del computo de horas consecutivas
El sistema SHALL computar el limite sobre la union de los intervalos de las reservas del usuario en estado `PENDIENTE` o `APROBADA` de la fecha de la nueva solicitud, con independencia del espacio, e incluir en esa union la franja de la nueva solicitud. SHALL computar la union de los intervalos y no la suma de sus duraciones.

#### Scenario: Reservas separadas por un hueco que no se acumula
- **WHEN** un usuario ya tiene una reserva de 08:00 a 12:00 y crea otra de 13:00 a 15:00 en la misma fecha
- **THEN** la API responde `201` con la nueva reserva
- **AND** la regla NO se activa porque los bloques no son continuos aunque el total reservado sea de 6 horas

#### Scenario: El computo abarca reservas en espacios distintos
- **WHEN** un usuario ya tiene una reserva de 09:00 a 11:00 en un laboratorio y crea otra de 11:00 a 14:00 en un auditorio de la misma fecha
- **THEN** la API responde `422` con el codigo de error `HORAS_CONSECUTIVAS_EXCEDIDAS`

#### Scenario: El computo ignora las reservas en estado terminal
- **WHEN** un usuario tiene una reserva cancelada de 09:00 a 13:00 y crea otra de 13:00 a 15:00 en la misma fecha
- **THEN** la API responde `201` con la nueva reserva

#### Scenario: El computo ignora las reservas de otras personas
- **WHEN** otra persona tiene una reserva de 11:00 a 15:00 en el mismo espacio y el usuario crea una de 09:00 a 13:00
- **THEN** la API responde `422` con el codigo de error `ESPACIO_OCUPADO` y no con `HORAS_CONSECUTIVAS_EXCEDIDAS`

#### Scenario: El computo se limita a la fecha de la nueva reserva
- **WHEN** un usuario tiene una reserva de 09:00 a 13:00 el dia anterior y crea otra de 09:00 a 11:00 en el dia de la solicitud
- **THEN** la API responde `201` con la nueva reserva
