# Design — Limite de 4 horas consecutivas

> Documento tecnico del cambio `limit-4-horas-consecutivas` (Fase 4 de la ETAPA 2).
> El "por que" esta en `proposal.md`; el "que" esta en `specs/reservation-management/spec.md`; este documento explica el "como".

## Context

El sistema ya esta implementado, verificado y archivado en `openspec/specs/`. La institucion solicita ahora una regla de negocio nueva: **ningun usuario podra reservar un espacio academico durante mas de cuatro horas consecutivas**.

Restricciones heredadas del diseno vigente que condicionan la solucion:

- El modelo temporal es **fecha civil + hora local** (`YYYY-MM-DD` y `HH:MM`), con intervalos semiabiertos `[inicio, fin)`.
- La exclusion mutua de franjas se resuelve con una transaccion `BEGIN IMMEDIATE` que hace inseparables la verificacion y la insercion.
- El dominio es puro: las reglas de calculo no pueden depender de la base de datos.
- La instancia de negocio (`usuario`) se deduce de la peticion, no del cuerpo de la reserva.

## Goals / Non-Goals

**Goals**

- Rechazar una reserva individual de mas de 240 minutos.
- Rechazar la creacion de un **bloque continuo** de reservas del mismo usuario que supere 240 minutos en una misma fecha.
- Evaluar el computo de forma atomica respecto de la insercion, de modo que dos solicitudes concurrentes del mismo usuario sobre franjas contiguas no puedan prosperar ambas.
- No modificar el esquema de base de datos ni el contrato HTTP existente.
- Mantener el dominio testeable de forma aislada.

**Non-Goals (decisiones de diseno)**

- **No se revalidan las reservas ya persistidas.** La regla se aplica a las solicitudes nuevas. Una revalidacion historica exigiria una migracion de datos con decisiones de negocio sobre reservas ya concedidas (rechazar, recortar o cancelar) que la institucion no ha definido.
- **No se implementa un "credito de horas" diario.** La regla habla de horas **consecutivas**, no de horas acumuladas. Sumar duraciones sin importar el hueco entre ellas seria una regla distinta.
- **No se limita el numero de reservas ni el total de horas reservadas en el dia.** Solo el bloque continuo.
- **No se introduce una tabla de configuracion de la regla.** El limite es un parametro de configuracion del despliegue.

## Decisions

### D1 · La unidad de medida es el **minuto**, no la hora

**Decision.** El limite se expresa en minutos (`240`) y se configura con `LIMITE_HORAS_CONSECUTIVAS` expresada en horas en el entorno, convertida a minutos en la carga de configuracion. La duracion de una franja se mide con `minutosEntre(horaInicio, horaFin)`.

**Alternativas consideradas.**

- *Comparar horas decimales*: descartable por error de redondeo en los bordes (2,999 h vs 3 h). Con minutos, el borde es exacto y el escenario "exactamente cuatro horas" es inequivoco.
- *Comparar instantes `Date`*: innecesario; el modelo del sistema ya trabaja con minutos desde la medianoche.

**Consecuencia.** El limite superior e inferior son exactos: una reserva de 09:00 a 13:00 (240 min) se acepta y una de 09:00 a 13:01 (241 min) se rechaza. La prueba de esto es explicita.

### D2 · El computo se hace sobre la **union de intervalos**, no sobre la suma de duraciones

**Decision.** Se toman los intervalos de todas las reservas activas del usuario en la fecha, se anade el intervalo de la nueva solicitud, se fusionan los solapamientos y los contactos con `fusionarIntervalos` (funcion ya existente y probada en `src/domain/tiempo.ts`) y se comprueba que ningun bloque resultante supere los 240 minutos.

**Alternativas consideradas.**

- *Sumar duraciones*: incorrecto. Un docente con 08:00-12:00 y 13:00-15:00 tiene 6 horas reservadas pero ningun bloque continuo de mas de 4 horas; la suma rechazaria una agenda legitima.
- *Contar solo las reservas del mismo espacio*: corresponde a la lectura A descartada en `proposal.md`.
- *Reimplementar la fusion dentro del servicio*: rechazada; `fusionarIntervalos` ya vive en el dominio y esta cubierta por pruebas unitarias. Reutilizarla es la opcion de menor coste y menor riesgo.

**Consecuencia.** La regla tiene un comportamiento intuitivo: "no puedo tener mas de 4 horas seguidas reservadas". Los huecos entre reservas rompen la continuidad y no se acumulan.

### D3 · El computo se realiza **dentro de la transaccion `IMMEDIATE`**

**Decision.** La verificacion de las horas consecutivas se ejecuta dentro de la misma transaccion `BEGIN IMMEDIATE` que verifica el solapamiento e inserta la reserva. La consulta de las reservas activas del usuario en la fecha forma parte de esa transaccion.

**Alternativas consideradas.**

- *Calcular las horas consecutivas fuera de la transaccion y solo el solapamiento dentro*: deja una ventana en la que dos solicitudes concurrentes del mismo usuario (09:00-11:00 y 11:00-13:00) podrian ambas pasar el computo y ambas insertarse, dejando un bloque continuo de 4 horas... o de 6. Es exactamente el mismo tipo de carrera que el sistema ya evita para el solapamiento, y no tiene sentido reintroducirlo para la regla nueva.
- *Bloqueo optimista con reintento*: mas complejo y con la misma ventana.

**Consecuencia.** El computo y la insercion son atomicos. La prueba de concurrencia del propio escenario de aceptacion lo verifica.

### D4 · La consulta de las reservas del usuario se generaliza por fecha

**Decision.** El metodo `listarActivasDeUsuarioEnEspacio(usuarioId, espacioId, fecha)` se renombra a `listarActivasDeUsuarioEnFecha(usuarioId, fecha)` y deja de filtrar por espacio, porque el computo debe abarcar todos los espacios del usuario en esa fecha.

**Alternativas consideradas.**

- *Anadir un metodo nuevo y conservar el anterior*: dejaria codigo muerto. El metodo anterior solo se usaba para esta regla, que todavia no existia en el sistema, de modo que el renombrado es la operacion correcta.
- *Calcular la union en SQL con funciones de ventana*: SQLite no tiene `range` ni agregacion de intervalos; habria que emularlo con funciones de ventana y `LEAD`, con una complejidad y una fragilidad muy superiores a la fusion en memoria. Descartado.

**Consecuencia.** La consulta usa el indice `idx_reservas_usuario_fecha` (`reservas(usuario_id, fecha)`), ya declarado en el esquema, por lo que no se requiere ningun indice nuevo ni cambio de esquema. El filtro por estado se aplica en la propia consulta.

### D5 · Dos codigos de error distintos, no uno

**Decision.** `DURACION_EXCEDIDA` (422) para el limite por reserva y `HORAS_CONSECUTIVAS_EXCEDIDAS` (422) para el limite de bloques continuos.

**Alternativas consideradas.**

- *Un unico codigo `LIMITE_HORAS_EXCEDIDO`*: obligaria al cliente a parsear el mensaje para distinguir el caso, y el mensaje es la parte del contrato menos estable.
- *Fusionarlos en `VALIDACION`*: perderia la accionabilidad. La institucion necesita poder identificar en la bitacora cuantos solicitudes chocan con cada limite, y el codigo estable lo permite sin analisis de texto.

**Consecuencia.** El detalle de cada error incluye los valores concretos: la duracion solicitada y el maximo, o el bloque continuo conflictivo en formato `HH:MM - HH:MM`. La interfaz web muestra el mensaje tal cual, de modo que la persona usuaria sabe exactamente cual es el bloque que debe dividir.

### D6 · El limite es configurable, con valor por defecto de 4 horas

**Decision.** `LIMITE_HORAS_CONSECUTIVAS=4` en la configuracion, convertida a minutos en `cargarConfig`. Si el valor es invalido (no numerico, no positivo o cero), la carga de configuracion falla al arrancar.

**Alternativas consideradas.**

- *Constante en el codigo*: menos flexible; la institucion podria querer ajustarlo sin un despliegue.
- *Tabla de parametros en la base de datos*: la regla debe ser auditable y versionable; un valor en el repositorio queda en el historial de Git, que es justamente la evidencia que pide la cátedra. La tabla solo se justifica si el ajuste debe ser en caliente por personal no tecnico.

**Consecuencia.** El comportamiento por defecto es el solicitado por la institucion, pero el parametro queda a una linea de cambio de distancia. La prueba de la regla fija el valor por defecto, de modo que cualquier cambio accidental se detectaria.

### D7 · La regla no altera los estados ni el flujo de aprobacion

**Decision.** La regla se aplica unicamente en la creacion de la reserva. Una vez creada, la reserva puede aprobarse, rechazarse o cancelarse con normalidad. Una reserva ya existente que supere el limite (creada antes de la regla, o en un despliegue con un limite mayor) no se invalida al aprobarla.

**Alternativas consideradas.**

- *Validar tambien en la aprobacion*: obligaria a reevaluar y posiblemente a revocar solicitudes ya concedidas, con el efecto colateral de bloquear aprobaciones legitimas de solicitudes antiguas. Ademas, la reserva pendiente ya ocupa la franja, por lo que el recurso ya esta reservado de facto.

**Consecuencia.** La comprobacion esta en un unico punto del flujo de creacion. El escenario de la especificacion "El computo ignora las reservas en estado terminal" verifica que una reserva cancelada no bloquea.

## Risks / Trade-offs

| Riesgo | Mitigacion |
|---|---|
| **R-11. La regla rechaza combinaciones legitimas de franjas y bloquea la actividad de un docente con agenda fragmentada.** | El computo se hace sobre la union de intervalos, no sobre la suma de duraciones: las franjas separadas por un hueco se admiten. El mensaje de error indica el bloque continuo conflictivo, de modo que el docente sabe que debe partirlo. La institucion puede ajustar el limite mediante `LIMITE_HORAS_CONSECUTIVAS` sin tocar el codigo. |
| La regla se calcula sobre datos ya persistidos y podria quedar desfasada si otra transaccion inserta entre el calculo y la insercion. | El calculo se ejecuta dentro de la transaccion `BEGIN IMMEDIATE`, que toma el bloqueo de escritura de la base de datos. No existe ventana entre el calculo y la insercion. |
| El computo requiere una consulta adicional en cada creacion de reserva. | Usa el indice `(usuario_id, fecha)` ya declarado. El numero de reservas de un usuario en una fecha es pequeño (decenas como maximo). |
| Los mensajes de error en espanol sin acentos pueden resultar poco claros para la persona usuaria. | El mensaje incluye datos concretos (duracion, maximo, bloque conflictivo) en formato `HH:MM - HH:MM`, que es legible independientemente del idioma. |
| La regla no se aplica retroactivamente a las reservas existentes, de modo que el estado de la institucion puede quedar incoherente. | Es una decision consciente y documentada (`proposal.md`, Goals/Non-Goals). Revalidar historico exigiria una politica de negocio sobre reservas ya concedidas que la institucion no ha definido. Se registra como punto abierto para la institucion. |

## Migration Plan

**No hay migracion de datos ni de esquema.** El cambio es exclusivamente de comportamiento.

Despliegue:

1. Desplegar la nueva version (el parametro `LIMITE_HORAS_CONSECUTIVAS` tiene valor por defecto 4, asi que no requiere tocar el `.env`).
2. Verificar con la prueba automatizada del cambio y con la comprobacion manual de los escenarios de aceptacion.
3. Comunicar la regla a la comunidad academica: es un cambio que afecta a la operativa diaria (un docente con 5 horas de clase seguidas en dos espacios vera rechazada la segunda reserva).

**Reversa:** revertir el commit de implementacion (o desplegar la version anterior). No hay datos transformados, por lo que la reversa es completa e instantanea. La unica consideracion es que las reservas creadas mientras la regla estuvo vigente siguen existiendo; al revertir la regla, esas reservas se mantienen y vuelven a ser validas.

## Open Questions

Ninguna que afecte a la especificacion, al enfoque o al desglose de tareas de este change.

**Cuestion abierta para la institucion (no bloqueante):** ¿La regla debe aplicarse tambien de forma retroactiva a las reservas ya confirmadas y, en ese caso, que debe ocurrir con ellas (dejarlas, recortarlas o cancelarlas)? La implementacion actual **no** revalida el historico, porque ello exigiria una politica de negocio sobre reservas ya concedidas que la institucion no ha definido. Si se necesita ese comportamiento, la institucion puede solicitar un change separado.
