# auth Specification

## Purpose
Permite que las personas usuarias del sistema se identifiquen de forma segura, obtengan un token de sesion valido y consulten su propio perfil, incluidas las acciones de registro, inicio y cierre de sesion.

## Requirements

### Requirement: Registro publico con rol de menor privilegio
El sistema SHALL permitir el registro de una persona usuaria mediante nombre, correo electronico y contrasena. SHALL asignar siempre el rol `ESTUDIANTE` y SHALL rechazar con `422` y el codigo `ROL_NO_PERMITIDO` cualquier rol distinto de `ESTUDIANTE` en una peticion publica. SHALL responder `201` con el usuario creado (sin la contrasena) y el token de sesion.

#### Scenario: Registro valido
- **WHEN** una persona solicita el registro con nombre "Ana Torres", correo "ana@uni.edu" y contrasena "clave1234"
- **THEN** la API responde `201` con el usuario creado, rol `ESTUDIANTE`, estado activo y un token de sesion
- **AND** la contrasena almacenada NO es legible en texto plano

#### Scenario: Intento de autoasignar un rol privilegiado
- **WHEN** una persona solicita el registro con rol `ADMIN`
- **THEN** la API responde `422` con el codigo de error `ROL_NO_PERMITIDO`
- **AND** no se crea ningun usuario

### Requirement: Validacion de los datos de registro
El sistema SHALL validar que el correo tenga formato valido, que la contrasena tenga al menos 8 caracteres y que contenga al menos una letra y un digito. SHALL rechazar un correo ya registrado con `409` y el codigo `EMAIL_DUPLICADO`. SHALL responder `422` con el codigo `VALIDACION` y el detalle de los campos invalidos ante datos invalidos. En todos los casos de rechazo SHALL omitir la creacion del usuario.

#### Scenario: Correo electronico duplicado
- **WHEN** se intenta registrar un correo que ya esta registrado
- **THEN** la API responde `409` con el codigo de error `EMAIL_DUPLICADO`
- **AND** no se crea ningun usuario nuevo

#### Scenario: Contrasena insegura
- **WHEN** se intenta registrar con una contrasena de menos de 8 caracteres o sin digito
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle de los campos invalidos
- **AND** no se crea ningun usuario

### Requirement: Inicio de sesion
El sistema SHALL autenticar a una persona usuaria mediante correo electronico y contrasena. SHALL responder `200` con el token de sesion y los datos publicos del usuario cuando las credenciales sean validas, y `401` con el codigo `CREDENCIALES_INVALIDAS` cuando no lo sean. No SHALL revelar si el correo existe o no.

#### Scenario: Credenciales validas
- **WHEN** una persona envia el correo y la contrasena correctos de un usuario activo
- **THEN** la API responde `200` con un token de sesion y los datos del usuario, sin incluir la contrasena

#### Scenario: Contrasena incorrecta
- **WHEN** una persona envia un correo existente con una contrasena incorrecta
- **THEN** la API responde `401` con el codigo de error `CREDENCIALES_INVALIDAS`

#### Scenario: Usuario desactivado
- **WHEN** una persona envia las credenciales correctas de un usuario que esta desactivado
- **THEN** la API responde `401` con el codigo de error `CREDENCIALES_INVALIDAS`

### Requirement: Emision y expiracion del token de sesion
El sistema SHALL emitir un token firmado que contenga unicamente el identificador del usuario y su version de token. El rol y los permisos SHALL resolverse desde la base de datos en cada peticion, de modo que un cambio de rol surta efecto inmediato sobre los tokens ya emitidos. SHALL rechazar cualquier token que no tenga firma valida, que haya expirado o cuya version de token sea anterior a la del usuario. SHALL responder `401` con el codigo `NO_AUTENTICADO` en esos casos.

#### Scenario: Token valido
- **WHEN** una peticion incluye un token vigente emitido para un usuario activo
- **THEN** la API procesa la peticion usando la identidad de ese usuario

#### Scenario: El token no transporta el rol
- **WHEN** se decodifica un token emitido por el sistema
- **THEN** su contenido incluye el identificador del usuario y la version de token
- **AND** NO incluye el rol ni la lista de permisos

#### Scenario: Token expirado
- **WHEN** una peticion incluye un token cuya fecha de expiracion ya paso
- **THEN** la API responde `401` con el codigo de error `NO_AUTENTICADO`

#### Scenario: Token con firma invalida
- **WHEN** una peticion incluye un token cuya firma no corresponde al secreto configurado
- **THEN** la API responde `401` con el codigo de error `NO_AUTENTICADO`

#### Scenario: Token revocado por desactivacion del usuario
- **WHEN** un usuario fue desactivado despues de que se emitio su token y se usa ese token
- **THEN** la API responde `401` con el codigo de error `NO_AUTENTICADO`

#### Scenario: Peticion sin credenciales
- **WHEN** una peticion a un endpoint protegido no incluye token
- **THEN** la API responde `401` con el codigo de error `NO_AUTENTICADO`

### Requirement: Consulta del perfil propio
El sistema SHALL devolver los datos publicos del usuario autenticado, incluidos su identificador, nombre, correo, rol y estado, sin exponer la contrasena ni el hash. SHALL requerir un token valido.

#### Scenario: Perfil del usuario autenticado
- **WHEN** un usuario autenticado solicita su propio perfil
- **THEN** la API responde `200` con su identificador, nombre, correo, rol y estado activo
- **AND** la respuesta NO contiene ningun campo de contrasena

### Requirement: Cierre de sesion
El sistema SHALL invalidar todos los tokens emitidos previamente para el usuario autenticado al registrar un cierre de sesion, de modo que un token reutilizado con posterioridad sea rechazado. SHALL responder `204` sin cuerpo.

#### Scenario: Token invalido tras el cierre de sesion
- **WHEN** un usuario cierra sesion y luego reutiliza el token que emitio antes del cierre
- **THEN** la API responde `401` con el codigo de error `NO_AUTENTICADO`

#### Scenario: Sesion nueva tras el cierre
- **WHEN** un usuario que cerro sesion vuelve a iniciar sesion con credenciales validas
- **THEN** la API responde `200` con un token nuevo que si habilita el acceso

### Requirement: Limite de intentos de inicio de sesion
El sistema SHALL registrar en la bitacora los intentos de inicio de sesion fallidos. SHALL bloquear con `429` y el codigo `DEMASIADOS_INTENTOS` el inicio de sesion de un correo que acumule 5 intentos fallidos en una ventana de 15 minutos. El bloqueo SHALL expirar una vez transcurrida esa ventana. SHALL responder `401` con el codigo `CREDENCIALES_INVALIDAS` en cada intento fallido no bloqueado, sin revelar si la cuenta existe.

#### Scenario: Intento fallido registrado
- **WHEN** una persona intenta iniciar sesion con una contrasena incorrecta
- **THEN** la bitacora registra un evento de tipo `LOGIN_FALLIDO` asociado al correo intentado
- **AND** la API responde `401` con el codigo de error `CREDENCIALES_INVALIDAS`

#### Scenario: Bloqueo tras superar el limite
- **WHEN** un mismo correo acumula 5 intentos de inicio de sesion fallidos dentro de 15 minutos
- **THEN** el siguiente intento responde `429` con el codigo de error `DEMASIADOS_INTENTOS`
- **AND** no se emite ningun token de sesion

#### Scenario: El bloqueo expira
- **WHEN** han transcurrido mas de 15 minutos desde el ultimo intento fallido de un correo bloqueado
- **THEN** un nuevo intento con credenciales validas responde `200` con un token de sesion

#### Scenario: El bloqueo no afecta a otros correos
- **WHEN** un correo esta bloqueado por intentos fallidos
- **THEN** el inicio de sesion de otro correo no responde `429`
