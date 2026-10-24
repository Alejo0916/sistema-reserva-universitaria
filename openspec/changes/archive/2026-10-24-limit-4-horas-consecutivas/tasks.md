# Tasks

> Plan de trabajo del change `limit-4-horas-consecutivas` (Fase 4 de la ETAPA 2).
> Derivado de `specs/reservation-management/spec.md` (que) y `design.md` (como).
> Cada tarea indica como se verifica su cumplimiento.

## 1. Configuracion y catalogo de errores

- [x] 1.1 Anadir `LIMITE_HORAS_CONSECUTIVAS` a `src/shared/config.ts`, en horas, con valor por defecto 4, validando que sea un numero positivo. Verificacion: prueba unitaria en `tests/unit/infraestructura.test.ts` que comprueba el valor por defecto y que la carga falla con un valor no numerico o no positivo.
- [x] 1.2 Exponer el limite ya convertido a minutos en el contenedor de dependencias, para que el caso de uso lo reciba sin recalcularlo. Verificacion: `npm run typecheck` y comprobacion de que el valor llega en minutos al servicio.
- [x] 1.3 Anadir a `src/domain/errores.ts` los codigos `DURACION_EXCEDIDA` (422) y `HORAS_CONSECUTIVAS_EXCEDIDAS` (422) con sus mensajes. Verificacion: prueba unitaria en `tests/unit/errores.test.ts` que comprueba codigo, estado y presencia de detalles.

## 2. Persistencia

- [x] 2.1 Renombrar `listarActivasDeUsuarioEnEspacio` a `listarActivasDeUsuarioEnFecha` en `src/db/repositorios/reservaRepo.ts` y eliminar el filtro por espacio, conservando el filtro por estado `PENDIENTE`/`APROBADA` y el uso del indice `(usuario_id, fecha)`. Verificacion: `npm run typecheck` y prueba de integracion que comprueba que la consulta devuelve las reservas del usuario en la fecha con independencia del espacio.
- [x] 2.2 Comprobar que no se requiere ningun cambio de esquema ni indice nuevo. Verificacion: `git diff --stat src/db/schema.sql` no muestra cambios y el plan de consulta usa `idx_reservas_usuario_fecha`.

## 3. Reglas de dominio

- [x] 3.1 Implementar en `src/modules/reservation-management/application/servicioReservas.ts` la validacion `validarDuracion`, que rechace con `DURACION_EXCEDIDA` toda reserva cuya duracion supere el limite, indicando duracion solicitada y maximo. Verificacion: prueba de integracion con una reserva de 241 minutos y otra de exactamente 240.
- [x] 3.2 Incorporar la comprobacion de duracion maxima a `validarCoherencia`, respetando el orden de validacion fijado en `proposal.md` (coherencia y duracion antes que anticipacion). Verificacion: prueba de integracion que comprueba que una reserva en el pasado con duracion excesiva responde `VALIDACION` y no `DURACION_EXCEDIDA`.
- [x] 3.3 Implementar la validacion `validarHorasConsecutivas`, que calcule la union de los intervalos de las reservas activas del usuario en la fecha mas la franja de la nueva solicitud, usando `fusionarIntervalos` del dominio, y rechace con `HORAS_CONSECUTIVAS_EXCEDIDAS` si algun bloque continuo supera el limite, indicando el bloque conflictivo. Verificacion: pruebas de integracion de los siete escenarios del requisito.
- [x] 3.4 Ejecutar el computo de las horas consecutivas DENTRO de la transaccion `IMMEDIATE`, junto con la verificacion de disponibilidad. Verificacion: prueba de concurrencia con dos solicitudes contiguas simultaneas del mismo usuario.

## 4. Integracion con el flujo de creacion

- [x] 4.1 Incluir la nueva validacion en el flujo de `crear`, en la posicion 7 del orden de validacion (despues de asistentes y antes de disponibilidad). Verificacion: prueba de integracion que comprueba que una franja ocupada por otra persona responde `ESPACIO_OCUPADO` y no `HORAS_CONSECUTIVAS_EXCEDIDAS`.
- [x] 4.2 Comprobar que el estado inicial, la bitacora y el resto del flujo de la reserva no cambian. Verificacion: la suite completa sigue en verde y la prueba "crea la reserva en estado PENDIENTE y registra el evento" no se modifica.

## 5. Pruebas de no regresion y cierre del change

- [x] 5.1 Anadir a `tests/integracion/reservas.test.ts` un bloque de pruebas con los escenarios nuevos de la regla de 4 horas. Verificacion: `npm test` en verde.
- [x] 5.2 Ejecutar la suite completa y confirmar que ningun test existente ha necesitado cambiar de comportamiento. Verificacion: `git diff` sobre `tests/` solo anade pruebas; si alguna prueba existente cambia, se documenta el motivo.
- [x] 5.3 Actualizar `docs/TRAZABILIDAD.md` con las filas de los requisitos nuevos y con la modificacion del requisito de coherencia de la franja. Verificacion: cada requisito nuevo tiene una fila que referencia un test existente.
- [x] 5.4 Anadir el addendum de impacto a `PLAN_INGENIERIA.md` (capitulo 9), sin alterar el contenido original. Verificacion: `git diff` muestra solo lineas anadidas al final del documento.
- [x] 5.5 Actualizar la seccion de reglas de negocio del `README.md` con la nueva regla. Verificacion: revision del README contra la especificacion del change.
- [x] 5.6 Ejecutar `npm run verify` (typecheck + lint + tests + validacion OpenSpec). Verificacion: la cadena completa termina con codigo de salida 0.
- [x] 5.7 Validar el change con `openspec validate limit-4-horas-consecutivas --strict`. Verificacion: la validacion pasa sin errores.

## Workflow follow-up

- Archivar el change con `openspec archive limit-4-horas-consecutivas --yes` una vez completadas las tareas 1 a 5, de modo que el delta se fusione en `openspec/specs/reservation-management/spec.md`.
- Verificar el resultado archivado con `openspec validate --strict` y `openspec list --specs`.
