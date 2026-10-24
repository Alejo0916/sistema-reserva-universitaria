# Spec Delta

## Purpose

Permite que las personas usuarias del sistema se identifiquen de forma segura, obtengan un token de sesion valido y consulten su propio perfil, incluidas las acciones de registro, inicio y cierre de sesion.

## ADDED Requirements

### Requirement: Registro publico de usuario
El sistema SHALL permitir el registro de una persona usuaria mediante nombre, correo electronico, contrasena y rol, asignando por defecto el rol `ESTUDIANTE` cuando el rol no se indica. SHALL validar que el correo tenga formato valido, que la contrasena tenga al menos 8 caracteres y que contenga al menos una letra y un digito. SHALL responder `201` con el usuario creado (sin la contrasena) y el token de sesion.

#### Scenario: Registro valido con rol por defecto
- **WHEN** una persona solicita el registro con nombre "Ana Torres", correo "ana@uni.edu" y contrasena "clave1234"
- **THEN** la API responde `201` con el usuario creado, rol `ESTUDIANTE`, estado activo y un token de sesion
- **AND** la contrasena almacenada NO es legible en texto plano

#### Scenario: Registro con rol explicito valido
- **WHEN** una persona solicita el registro con nombre "Luis Paz", correo "luis@uni.edu", contrasena "clave1234" y rol `DOCENTE`
- **THEN** la API responde `201` con el usuario creado y rol `DOCENTE`

#### Scenario: Correo electronico duplicado
- **WHEN** se intenta registrar un correo que ya esta registrado
- **THEN** la API responde `409` con el codigo de error `EMAIL_DUPLICADO`
- **AND** no se crea ningun usuario nuevo

#### Scenario: Contrasena insegura
- **WHEN** se intenta registrar con una contrasena de menos de 8 caracteres o sin digito
- **THEN** la API responde `422` con el codigo de error `VALIDACION` y el detalle de los campos invalidos
- **AND** no se crea ningun usuario

#### Scenario: Rol inexistente
- **WHEN** se intenta registrar con un rol que no existe en el catalogo
- **THEN** la API responde `422` con el codigo de error `ROL_DESCONOCIDO`

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
El sistema SHALL emitir un token firmado que contenga el identificador del usuario, su version de token y su rol. SHALL rechazar cualquier token que no tenga firma valida, que haya expirado o cuya version de token sea anterior a la del usuario. SHALL responder `401` con el codigo `NO_AUTENTICADO` en esos casos.

#### Scenario: Token valido
- **WHEN** una peticion incluye un token vigente emitido para un usuario activo
- **THEN** la API procesa la peticion usando la identidad de ese usuario

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

### Requirement: Proteccion contra fuerza bruta
El sistema SHALL registrar en la bitacora los intentos de inicio de sesion fallidos y SHALL responder `401` con el codigo `CREDENCIALES_INVALIDAS` en cada intento fallido, sin revelar si la cuenta existe.

#### Scenario: Intento fallido registrado
- **WHEN** una persona intenta iniciar sesion con una contrasena incorrecta
- **THEN** la bitacora registra un evento de tipo `LOGIN_FALLIDO` asociado al correo intentado
- **AND** la API responde `401` con el codigo de error `CREDENCIALES_INVALIDAS`
