# reservation-management Specification

## Purpose
Permite crear, consultar y cancelar las solicitudes de reserva de espacios academicos, aplicando de forma automatica y transaccional las reglas de negocio que garantizan que una franja horaria no se asigne a dos solicitudes y que las reservas se encajen dentro de las restricciones de la institucion.

## Requirements

### Requirement: Numero de asistentes frente a la capacidad del espacio
El sistema SHALL admitir un campo opcional `asistentes` en la solicitud de reserva. Si se indica, SHALL ser un entero mayor que cero y SHALL NOT superar la capacidad del espacio solicitado. SHALL responder `422` con el codigo `CAPACIDAD_EXCEDIDA` cuando lo supere.

#### Scenario: Asistentes dentro de la capacidad
- **WHEN** se solicita un espacio con capacidad 24 una reserva para 20 asistentes
- **THEN** la API responde `201` y la reserva registra 20 asistentes

#### Scenario: Asistentes por encima de la capacidad
- **WHEN** se solicita un espacio con capacidad 24 una reserva para 30 asistentes
- **THEN** la API responde `422` con el codigo de error `CAPACIDAD_EXCEDIDA`
- **AND** no se persiste ninguna reserva

#### Scenario: Asistentes omitido
- **WHEN** se solicita una reserva sin indicar el numero de asistentes
- **THEN** la API responde `201` y la reserva registra el numero de asistentes como nulo

### Requirement: Orden de validacion de la solicitud
El sistema SHALL evaluar las reglas de una solicitud en el siguiente orden: existencia del espacio, coherencia de la franja y de la fecha, anticipacion minima, encaje en el horario del espacio, numero de asistentes y, por ultimo, disponibilidad de la franja. SHALL devolver el error de la primera regla incumplida.

#### Scenario: La fecha en el pasado prevalece sobre la anticipacion
- **WHEN** se solicita una reserva con una fecha anterior al dia actual
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle del campo `fecha`
- **AND** NO responde con el codigo `ANTICIPACION_INSUFICIENTE`

#### Scenario: El espacio inexistente prevalece sobre las demas reglas
- **WHEN** se solicita una reserva para un espacio que no existe con una franja de 10:00 a 12:00
- **THEN** la API responde `404` con el codigo de error `ESPACIO_NO_ENCONTRADO`

### Requirement: Creacion de solicitud de reserva
El sistema SHALL permitir que un usuario con el permiso `reservas:crear` cree una solicitud de reserva indicando espacio, fecha, hora de inicio, hora de fin y justificacion. SHALL crear la reserva en estado `PENDIENTE`, devolver `201` con la reserva creada y registrar en la bitacora un evento `RESERVA_CREADA`.

#### Scenario: Solicitud valida
- **WHEN** un estudiante solicita el espacio "LAB-101" el dia habil siguiente de 10:00 a 12:00 con justificacion "Practica de laboratorio"
- **THEN** la API responde `201` con la reserva en estado `PENDIENTE`
- **AND** la bitacora registra un evento `RESERVA_CREADA` con la identidad del solicitante

#### Scenario: Operacion sin permiso
- **WHEN** una peticion sin token intenta crear una reserva
- **THEN** la API responde `401` con el codigo de error `NO_AUTENTICADO`

#### Scenario: Justificacion ausente o demasiado corta
- **WHEN** se crea una reserva sin justificacion o con una justificacion de menos de 10 caracteres
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle del campo `justificacion`
- **AND** no se persiste ninguna reserva

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

### Requirement: Anticipacion minima de la solicitud
El sistema SHALL exigir que la solicitud se registre con una anticipacion minima configurable respecto al inicio de la reserva. Si la anticipacion minima es de 2 horas y una reserva comienza dentro de ese margen, SHALL responder `422` con el codigo de error `ANTICIPACION_INSUFICIENTE`.

#### Scenario: Solicitud con anticipacion suficiente
- **WHEN** se solicita una reserva que comienza dentro de 3 dias
- **THEN** la API responde `201`

#### Scenario: Solicitud sin anticipacion suficiente
- **WHEN** se solicita una reserva que comienza dentro de la ventana minima de anticipacion
- **THEN** la API responde `422` con el codigo de error `ANTICIPACION_INSUFICIENTE`
- **AND** no se persiste ninguna reserva

### Requirement: Encaje dentro del horario del espacio
El sistema SHALL exigir que la reserva completa, desde su hora de inicio hasta su hora de fin, quepa dentro del horario de funcionamiento del espacio. SHALL responder `422` con el codigo `FUERA_DE_HORARIO` cuando no quepa.

#### Scenario: Reserva dentro del horario
- **WHEN** se solicita un espacio con horario de 08:00 a 22:00 una reserva de 09:00 a 10:00
- **THEN** la API responde `201`

#### Scenario: Reserva que empieza antes de la apertura
- **WHEN** se solicita un espacio con horario de 08:00 a 22:00 una reserva de 07:00 a 09:00
- **THEN** la API responde `422` con el codigo de error `FUERA_DE_HORARIO`

#### Scenario: Reserva que termina despues del cierre
- **WHEN** se solicita un espacio con horario de 08:00 a 22:00 una reserva de 21:00 a 23:00
- **THEN** la API responde `422` con el codigo de error `FUERA_DE_HORARIO`

### Requirement: Un espacio inactivo no admite reservas
El sistema SHALL responder `404` con el codigo `ESPACIO_NO_ENCONTRADO` si el espacio no existe y `409` con el codigo `ESPACIO_INACTIVO` si el espacio existe pero esta inactivo. En ambos casos SHALL omitir la persistencia de la reserva.

#### Scenario: Espacio inexistente
- **WHEN** se solicita una reserva para un identificador de espacio que no existe
- **THEN** la API responde `404` con el codigo de error `ESPACIO_NO_ENCONTRADO`

#### Scenario: Espacio inactivo
- **WHEN** se solicita una reserva para un espacio desactivado
- **THEN** la API responde `409` con el codigo de error `ESPACIO_INACTIVO`

### Requirement: Prevencion de reservas simultaneas
El sistema SHALL impedir que coexistan dos reservas activas que se solapen en el mismo espacio y la misma fecha, entendiendo por activas las que estan en estado `PENDIENTE` o `APROBADA`. Dos franjas que solo se tocan en un extremo NO se consideran solapadas. SHALL responder `409` con el codigo `ESPACIO_OCUPADO` e indicar en el detalle la franja en conflicto.

#### Scenario: Solapamiento total
- **WHEN** ya existe una reserva pendiente de 10:00 a 12:00 y se solicita otra de 11:00 a 13:00 para el mismo espacio y fecha
- **THEN** la API responde `409` con el codigo de error `ESPACIO_OCUPADO`
- **AND** no se persiste la segunda reserva

#### Scenario: Solapamiento parcial
- **WHEN** ya existe una reserva pendiente de 10:00 a 12:00 y se solicita otra de 11:30 a 13:00
- **THEN** la API responde `409` con el codigo de error `ESPACIO_OCUPADO`

#### Scenario: Contencion de la reserva dentro de otra
- **WHEN** ya existe una reserva pendiente de 10:00 a 12:00 y se solicita otra de 10:30 a 11:00
- **THEN** la API responde `409` con el codigo de error `ESPACIO_OCUPADO`

#### Scenario: Franjas contiguas permitidas
- **WHEN** ya existe una reserva pendiente de 10:00 a 11:00 y se solicita otra de 11:00 a 12:00
- **THEN** la API responde `201` y ambas reservas coexisten

#### Scenario: La reserva en estado terminal no bloquea
- **WHEN** ya existe una reserva rechazada de 10:00 a 12:00 y se solicita otra de 11:00 a 13:00
- **THEN** la API responde `201`

#### Scenario: Solapamiento con reserva de otro espacio
- **WHEN** ya existe una reserva de 10:00 a 12:00 en el espacio A y se solicita una de 11:00 a 13:00 en el espacio B
- **THEN** la API responde `201`

### Requirement: Atomicidad del control de solapamiento
El sistema SHALL evaluar la disponibilidad y registrar la reserva dentro de una misma transaccion, de modo que dos solicitudes concurrentes sobre la misma franja produzcan como maximo una reserva activa. La reserva perdedora SHALL recibir `409` con el codigo `ESPACIO_OCUPADO` y no SHALL quedar persistida.

#### Scenario: Dos solicitudes concurrentes por la misma franja
- **WHEN** dos peticiones concurrentes solicitan la misma franja del mismo espacio y fecha
- **THEN** exactamente una responde `201` y la otra responde `409` con el codigo `ESPACIO_OCUPADO`
- **AND** en la base de datos existe una sola reserva para esa franja

### Requirement: Consulta de reservas
El sistema SHALL listar las reservas con filtros opcionales por espacio, por estado, por fecha y por solicitante. Los roles `DOCENTE` y `ESTUDIANTE` SHALL recibir unicamente sus propias reservas con independencia del filtro por solicitante, y los roles `ADMIN` y `COORDINADOR` la totalidad. SHALL responder `200` con el envelope `{ datos, total, pagina, limite }`.

#### Scenario: El estudiante solo ve sus reservas
- **WHEN** un estudiante lista las reservas y existen reservas de otros usuarios
- **THEN** la respuesta `200` contiene unicamente las reservas del propio estudiante

#### Scenario: El filtro por solicitante no amplía el alcance de un estudiante
- **WHEN** un estudiante lista las reservas filtrando por el identificador de otro usuario
- **THEN** la respuesta `200` sigue conteniendo unicamente las reservas del propio estudiante

#### Scenario: Filtro por estado
- **WHEN** un administrador lista las reservas filtrando por estado `PENDIENTE`
- **THEN** la respuesta `200` contiene unicamente reservas en estado `PENDIENTE`

#### Scenario: Filtro por fecha
- **WHEN** un administrador lista las reservas filtrando por una fecha concreta
- **THEN** la respuesta `200` contiene unicamente reservas de esa fecha

#### Scenario: Envelope de la coleccion
- **WHEN** un administrador lista las reservas
- **THEN** la respuesta `200` incluye las claves `datos`, `total`, `pagina` y `limite`
- **AND** `total` es mayor o igual que la cantidad de elementos de `datos`

### Requirement: Consulta del detalle de una reserva
El sistema SHALL devolver el detalle de una reserva existente, incluyendo espacio, solicitante, franja horaria, justificacion, estado y motivo de rechazo cuando exista. SHALL responder `404` con el codigo `RESERVA_NO_ENCONTRADA` si no existe, y SHALL restringirse a las reservas visibles para el rol del solicitante.

#### Scenario: Detalle de una reserva propia
- **WHEN** un estudiante solicita el detalle de una reserva que el mismo creo
- **THEN** la API responde `200` con todos los datos de la reserva

#### Scenario: Detalle de una reserva ajena no visible para el rol
- **WHEN** un estudiante solicita el detalle de una reserva creada por otra persona
- **THEN** la API responde `404` con el codigo de error `RESERVA_NO_ENCONTRADA`

### Requirement: Cancelacion de una reserva
El sistema SHALL permitir cancelar una reserva en estado `PENDIENTE` o `APROBADA`. El solicitante de la reserva o un usuario con el permiso `reservas:aprobar` SHALL poder cancelarla, y un tercero sin ese permiso SHALL recibir `403`. SHALL registrar en la bitacora un evento `RESERVA_CANCELADA` con el motivo.

#### Scenario: Cancelacion por el solicitante
- **WHEN** el solicitante cancela su reserva en estado `PENDIENTE` con el motivo "Se reprogramo la practica"
- **THEN** la API responde `200` con la reserva en estado `CANCELADA`
- **AND** la bitacora registra un evento `RESERVA_CANCELADA` con el motivo

#### Scenario: Cancelacion de una reserva ya cancelada
- **WHEN** se cancela una reserva que ya esta en estado `CANCELADA`
- **THEN** la API responde `409` con el codigo de error `ESTADO_INVALIDO`

#### Scenario: Cancelacion de una reserva rechazada
- **WHEN** se cancela una reserva en estado `RECHAZADA`
- **THEN** la API responde `409` con el codigo de error `ESTADO_INVALIDO`

#### Scenario: Cancelacion por un tercero sin permiso
- **WHEN** un tercer usuario sin el permiso `reservas:aprobar` intenta cancelar la reserva de otra persona
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`
- **AND** la reserva conserva su estado

#### Scenario: La franja liberada vuelve a estar disponible
- **WHEN** se cancela la unica reserva de una franja y se crea una nueva solicitud para esa misma franja
- **THEN** la API responde `201`

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
- **WHEN** un usuario envia dos solicitudes concurrentes de 09:00 a 11:00 y de 11:00 a 14:00 en la misma fecha y espacio
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
