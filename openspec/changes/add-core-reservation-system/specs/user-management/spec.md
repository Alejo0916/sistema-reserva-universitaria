# Spec Delta

## Purpose

Permite administrar el registro de las personas usuarias del sistema: alta con rol asignado, consulta y filtrado del directorio, actualizacion de datos, cambios de rol y desactivacion de cuentas, preservando siempre la trazabilidad de las reservas historicas.

## ADDED Requirements

### Requirement: Alta de usuario por administrador
El sistema SHALL permitir que un usuario con el permiso `usuarios:escribir` cree una persona usuaria con nombre, correo electronico, contrasena y rol. SHALL validar unicidad del correo y existencia del rol. SHALL responder `201` con el usuario creado y SHALL registrar en la bitacora un evento `USUARIO_CREADO`.

#### Scenario: Alta valida
- **WHEN** un administrador crea al usuario "Sara Ruiz" con correo "sara@uni.edu", contrasena "clave1234" y rol `COORDINADOR`
- **THEN** la API responde `201` con el usuario creado y rol `COORDINADOR`
- **AND** la bitacora registra un evento `USUARIO_CREADO` con el identificador del nuevo usuario

#### Scenario: Correo ya existente
- **WHEN** un administrador intenta crear un usuario con un correo ya registrado
- **THEN** la API responde `409` con el codigo de error `EMAIL_DUPLICADO`

#### Scenario: Rol desconocido
- **WHEN** un administrador intenta crear un usuario con un rol inexistente
- **THEN** la API responde `422` con el codigo de error `ROL_DESCONOCIDO`

#### Scenario: Operacion sin permiso
- **WHEN** un usuario sin el permiso `usuarios:escribir` intenta crear un usuario
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`

#### Scenario: Envelope del listado
- **WHEN** un administrador lista usuarios
- **THEN** la respuesta `200` incluye las claves `datos`, `total`, `pagina` y `limite`
- **AND** cada elemento de `datos` NO contiene ningun campo de contrasena

### Requirement: Directorio de usuarios
El sistema SHALL listar los usuarios registrados con paginacion y con filtros opcionales por rol, por estado activo y por texto libre sobre nombre o correo. SHALL exigir el permiso `usuarios:leer`. SHALL responder `200` con el envelope `{ datos, total, pagina, limite }` y con el total de coincidencias.

#### Scenario: Listado con filtro por rol
- **WHEN** un administrador lista usuarios filtrando por rol `DOCENTE`
- **THEN** la API responde `200` solo con usuarios cuyo rol sea `DOCENTE`
- **AND** cada elemento incluye identificador, nombre, correo, rol y estado activo

#### Scenario: Listado sin permiso
- **WHEN** un usuario sin el permiso `usuarios:leer` intenta listar usuarios
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`

#### Scenario: Correspondencia por nombre o correo
- **WHEN** un administrador lista usuarios con el texto libre "sara"
- **THEN** la API responde `200` con los usuarios cuyo nombre o correo contiene ese texto, sin distinguir mayusculas

### Requirement: Consulta de un usuario
El sistema SHALL devolver el detalle de un usuario existente por su identificador, sin exponer su contrasena ni el hash. SHALL responder `404` con el codigo `USUARIO_NO_ENCONTRADO` si el identificador no existe.

#### Scenario: Usuario existente
- **WHEN** un administrador solicita el detalle de un usuario existente
- **THEN** la API responde `200` con los datos publicos del usuario

#### Scenario: Usuario inexistente
- **WHEN** se solicita el detalle de un identificador de usuario que no existe
- **THEN** la API responde `404` con el codigo de error `USUARIO_NO_ENCONTRADO`

### Requirement: Actualizacion de datos y rol de un usuario
El sistema SHALL permitir que un usuario con el permiso `usuarios:escribir` actualice el nombre, el correo, el rol y el estado activo de un usuario. SHALL rechazar un correo duplicado con `409` y un rol inexistente con `422`. SHALL registrar en la bitacora un evento `USUARIO_ACTUALIZADO` con los campos modificados.

#### Scenario: Cambio de rol
- **WHEN** un administrador cambia el rol de un usuario de `ESTUDIANTE` a `DOCENTE`
- **THEN** la API responde `200` con el usuario ya actualizado
- **AND** la bitacora registra un evento `USUARIO_ACTUALIZADO` que indica el cambio de rol

#### Scenario: Correo duplicado en la actualizacion
- **WHEN** un administrador actualiza el correo de un usuario con el correo de otro usuario existente
- **THEN** la API responde `409` con el codigo de error `EMAIL_DUPLICADO`

#### Scenario: Administrador no puede quitarse su propio rol
- **WHEN** un administrador intenta quitarse a si mismo el rol `ADMIN`
- **THEN** la API responde `409` con el codigo de error `AUTOMODIFICACION_PROHIBIDA`

#### Scenario: Administrador no puede desactivarse a si mismo
- **WHEN** un administrador intenta desactivar su propia cuenta
- **THEN** la API responde `409` con el codigo de error `AUTOMODIFICACION_PROHIBIDA`
- **AND** la cuenta permanece activa

### Requirement: Desactivacion de usuario
El sistema SHALL permitir desactivar una cuenta de usuario en lugar de eliminarla, de modo que sus reservas historicas conserven la referencia valida. SHALL invalidar los tokens emitidos a ese usuario. SHALL registrar en la bitacora un evento `USUARIO_DESACTIVADO`.

#### Scenario: Desactivacion efectiva
- **WHEN** un administrador desactiva a un usuario activo
- **THEN** la API responde `200` con el usuario en estado inactivo
- **AND** la bitacora registra un evento `USUARIO_DESACTIVADO`

#### Scenario: El usuario desactivado no puede iniciar sesion
- **WHEN** un usuario desactivado intenta iniciar sesion con sus credenciales
- **THEN** la API responde `401` con el codigo de error `CREDENCIALES_INVALIDAS`

#### Scenario: El historial del usuario desactivado se conserva
- **WHEN** se consulta el historial de una reserva solicitada por un usuario desactivado
- **THEN** la API responde `200` y muestra el nombre del usuario desactivado como solicitante

### Requirement: Restablecimiento de contrasena por administrador
El sistema SHALL permitir que un usuario con el permiso `usuarios:escribir` asigne una contrasena nueva a un usuario. SHALL validar la misma robustez que en el registro e invalidar los tokens emitidos previamente a ese usuario.

#### Scenario: Contrasena restablecida
- **WHEN** un administrador asigna la contrasena "nueva1234" a un usuario
- **THEN** la API responde `200` con el usuario actualizado
- **AND** el usuario puede iniciar sesion con la contrasena nueva y no con la anterior
