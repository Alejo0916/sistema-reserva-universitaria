# Spec Delta

## Purpose

Define el control de acceso basado en roles y permisos del sistema: el catalogo de roles, la matriz de permisos asociados a cada rol, su exposicion para consulta y la verificacion efectiva de cada permiso antes de ejecutar una operacion protegida.

## ADDED Requirements

### Requirement: Catalogo de roles
El sistema SHALL mantener un catalogo de los roles `ADMIN`, `COORDINADOR`, `DOCENTE` y `ESTUDIANTE`. SHALL exponer el catalogo completo con los permisos asociados a cada rol a cualquier usuario autenticado. SHALL responder `200` con la coleccion de roles.

#### Scenario: Consulta del catalogo
- **WHEN** un usuario autenticado consulta los roles del sistema
- **THEN** la API responde `200` con los cuatro roles y la lista de permisos de cada uno

#### Scenario: Consulta sin autenticar
- **WHEN** una peticion sin token consulta el catalogo de roles
- **THEN** la API responde `401` con el codigo de error `NO_AUTENTICADO`

### Requirement: Catalogo de permisos
El sistema SHALL mantener un catalogo de permisos granulares para espacios, reservas, aprobacion de reservas, usuarios, roles y auditoria. SHALL exponer el catalogo a cualquier usuario autenticado.

#### Scenario: Consulta del catalogo de permisos
- **WHEN** un usuario autenticado consulta los permisos
- **THEN** la API responde `200` con el catalogo completo, incluyendo al menos `espacios:leer`, `espacios:escribir`, `reservas:crear`, `reservas:leer`, `reservas:cancelar`, `reservas:aprobar`, `usuarios:leer`, `usuarios:escribir`, `roles:leer` y `auditoria:leer`

### Requirement: Matriz de permisos por rol
El sistema SHALL asociar a cada rol un conjunto fijo de permisos. El rol `ADMIN` SHALL tener todos los permisos del catalogo. El rol `COORDINADOR` SHALL tener `espacios:leer`, `espacios:escribir`, `reservas:crear`, `reservas:leer`, `reservas:cancelar`, `reservas:aprobar`, `usuarios:leer`, `roles:leer` y `auditoria:leer`. Los roles `DOCENTE` y `ESTUDIANTE` SHALL tener unicamente `espacios:leer`, `reservas:crear`, `reservas:leer` y `reservas:cancelar`.

#### Scenario: Permisos del administrador
- **WHEN** se consulta la matriz de permisos
- **THEN** el rol `ADMIN` aparece con todos los permisos del catalogo

#### Scenario: Permisos del coordinador
- **WHEN** se consulta la matriz de permisos
- **THEN** el rol `COORDINADOR` aparece con el permiso `reservas:aprobar` y sin el permiso `usuarios:escribir`

#### Scenario: Permisos del estudiante
- **WHEN** se consulta la matriz de permisos
- **THEN** el rol `ESTUDIANTE` aparece sin el permiso `reservas:aprobar` ni con `usuarios:leer`

### Requirement: Verificacion efectiva de permisos
El sistema SHALL verificar el permiso requerido ANTES de ejecutar cada operacion protegida y SHALL responder `403` con el codigo de error `PERMISO_DENEGADO` cuando el usuario autenticado no lo posea. SHALL aplicar el permiso al rol vigente del usuario en el momento de la peticion.

#### Scenario: Operacion permitida
- **WHEN** un coordinador solicita aprobar una reserva y su rol incluye `reservas:aprobar`
- **THEN** la API ejecuta la operacion y no responde `403`

#### Scenario: Operacion denegada
- **WHEN** un estudiante intenta aprobar una reserva
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`
- **AND** no se modifica el estado de la reserva

#### Scenario: El permiso se evalua con el rol vigente
- **WHEN** a un usuario se le cambia el rol de `COORDINADOR` a `ESTUDIANTE` y luego intenta aprobar una reserva con su token vigente
- **THEN** la API responde `403` con el codigo de error `PERMISO_DENEGADO`

### Requirement: Alcance de la consulta de reservas segun el rol
El sistema SHALL permitir a los roles `ADMIN` y `COORDINADOR` consultar la totalidad de las reservas del sistema, mientras que los roles `DOCENTE` y `ESTUDIANTE` SHALL consultar unicamente sus propias reservas.

#### Scenario: El estudiante ve solo sus reservas
- **WHEN** un estudiante lista reservas y existe al menos una reserva de otro usuario
- **THEN** la respuesta `200` contiene unicamente las reservas solicitadas por ese estudiante

#### Scenario: El administrador ve todas las reservas
- **WHEN** un administrador lista reservas
- **THEN** la respuesta `200` contiene las reservas de todos los solicitantes
