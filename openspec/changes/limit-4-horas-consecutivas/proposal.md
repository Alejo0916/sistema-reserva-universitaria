# Proposal

## Why

La institucion solicita una nueva regla de negocio: **ningun usuario podra reservar un espacio academico durante mas de cuatro horas consecutivas**.

El sistema actual solo limita la duracion minima de una reserva (15 minutos), pero admite reservas de cualquier duracion y admite que una misma persona acumule multiples franjas consecutivas. En un contexto de recursos academicos compartidos yELLOWER capacidad limitada, esto permite que una sola persona monopolice la agenda de varios espacios a lo largo del dia, lo que contradice la politica de uso equitable que la institucion busca garantizar.

Esta regla se incorpora como un **cambio gestionado**: primero se actualiza la especificacion, despues se implementa y se prueba. No se modifica el codigo sin actualizacion previa de la especificacion.

## What Changes

- Se incorpora un **limite de duracion por reserva**: una reserva individual no puede superar los **240 minutos** (4 horas).
- Se incorpora un **limite de horas consecutivas por usuario**: la union de los intervalos reservados por una misma persona en una misma fecha, computada sobre sus reservas en estado `PENDIENTE` o `APROBADA`, no puede contener un bloque continuo superior a **240 minutos**.
- Se anaden dos codigos de error estables: `DURACION_EXCEDIDA` (422) y `HORAS_CONSECUTIVAS_EXCEDIDAS` (422).
- Se anaden dos requisitos nuevos a la capacidad `reservation-management` y se modifica el requisito `Validacion de la coherencia de la franja` para incorporar la duracion maxima.
- Se anaden pruebas automatizadas para la regla nueva y para la no regresion de las funcionalidades existentes.
- **No hay cambios incompatibles en la API**: los endpoints, los codigos de error preexistentes y el modelo de datos no cambian. Unicamente se anaden dos codigos de error y dos reglas de validacion.

## Capabilities

### New Capabilities

Ninguna. El cambio no introduce capacidades nuevas: modifica el comportamiento de una capacidad existente.

### Modified Capabilities

- `reservation-management`: se anaden los requisitos `Limite de duracion por reserva` y `Limite de horas consecutivas del usuario`, y se modifica el requisito `Validacion de la coherencia de la franja` para incorporar el limite maximo de duracion de 240 minutos.

## Impact

- **Codigo afectado:**
  - `src/modules/reservation-management/application/servicioReservas.ts`: nueva regla de validacion `validarDuracion` y ampliacion de `validarCoherencia`; nueva regla `validarHorasConsecutivas` que consulta las reservas activas del usuario en la fecha.
  - `src/db/repositorios/reservaRepo.ts`: el metodo `listarActivasDeUsuarioEnEspacio` se generaliza a `listarActivasDeUsuarioEnFecha`, para que el computo de la union de intervalos abarque todos los espacios de la persona usuaria en esa fecha.
  - `src/domain/tiempo.ts`: se reutiliza `fusionarIntervalos`, que ya implementa la union de intervalos; no se anade ninguna funcion nueva de tiempo.
  - `src/domain/errores.ts`: se anaden `DURACION_EXCEDIDA` y `HORAS_CONSECUTIVAS_EXCEDIDAS`.
  - `src/shared/config.ts`: se anade `LIMITE_HORAS_CONSECUTIVAS` (240 minutos), configurable por variable de entorno.
- **Base de datos:** **sin cambios de esquema**. El limite se calcula en tiempo de consulta sobre las reservas ya existentes.
- **API:** sin cambios de contrato. Dos codigos de error nuevos, ambos con estado `422`.
- **Documentacion:** `PLAN_INGENIERIA.md` recibe un addendum (capitulo 9) que documenta el impacto de la regla sobre el plan original; `docs/TRAZABILIDAD.md` se actualiza con los requisitos nuevos; `README.md` se actualiza con la regla en la seccion de reglas de negocio.
- **Compatibilidad:** las reservas ya persistidas no se revalidan retroactivamente. La regla se aplica en el momento de crear una reserva nueva.

---

## Nota sobre el analisis de impacto

### 1. Impacto sobre el plan de ingenieria

El plan original (`PLAN_INGENIERIA.md`, ETAPA 1) **no contemplaba ningun limite de duracion**: su seccion 1.4 declaraba que las reservas se confinan a una misma fecha civil y que el horario del espacio las acota, pero no establecia un tope de duracion. La regla nueva, por tanto, **anade una restriccion de negocio que el plan no preveia**.

Consecuencias sobre el plan:

| Seccion del plan | Efecto | Decision |
|---|---|---|
| §1.2 Necesidades (N4, N6) | Se anade una necesidad no contemplada: acotar el uso por persona. | Se registra como amplificacion, no como contradiccion: el objetivo de "fuente unica de verdad con integridad transaccional" se mantiene y se refuerza. |
| §1.4 Alcance y limitaciones | La limitacion L1 (reservas dentro de una misma fecha civil) pasa a ser **imprescindible**: el computo de horas consecutivas se hace por fecha. | Se mantiene sin cambios. La regla la reinforce en lugar de relajarla. |
| §3.3 Persistencia | El modelo temporal (fecha civil + hora local) es el que hace posible calcular la union de intervalos sin conversiones. | **Se confirma la decision**: el modelo elegido en la planificacion es el que hace barato y legible el calculo. |
| §3.4 D-3 (SQL sin ORM) | El computo de la union se hace en SQL (consulta de las reservas del usuario en la fecha) y en TypeScript (fusion de intervalos). | **Se confirma la decision**: el SQL a mano permite expresar la consulta con indices y sin capas de traduccion. |
| §5.2 Riesgos | Se anade un riesgo: que la regla rechace combinaciones legitimas de franjas y bloquee la actividad de un docente con agenda fragmentada. | Se registra como R-11 con su mitigacion (mensaje explicativo con la franja conflictiva). |
| §6.2 Uso de SDD | El ejemplo de la planificacion ya anticipaba los dos requisitos (limite por reserva y limite de horas consecutivas del mismo usuario). | **La regla aplicada es la que el plan anticipo**, lo que confirma la utilidad de haber especificado antes de implementar. |

El plan **no se reescribe**: se anade un capitulo 9 (addendum) que documenta el impacto, la decision y su motivo. El commit original de la ETAPA 1 permanece intacto en el historial, de modo que se conserva la evidencia del orden plan -> especificacion -> implementacion.

### 2. Impacto tecnico

- **Bajo en complejidad**: el calculo requiere una consulta adicional (las reservas activas del usuario en la fecha) y una operacion de union de intervalos sobre un conjunto pequeno (decenas de reservas).
- **Nulo en esquema**: no se anade ninguna tabla, columna ni indice.
- **Medio en riesgo de rechazo indebido**: es el punto que exige pruebas cuidadosas. Se mitiga con mensajes de error que indican la franja conflictiva.

### 3. Ambiguedad de la regla y su resolucion

El enunciado "ningun usuario podra reservar un espacio academico durante mas de cuatro horas consecutivas" admite dos lecturas:

| Lectura | Formulacion | Consecuencia |
|---|---|---|
| **A (por espacio)** | El limite se aplica a las reservas de un mismo usuario **en un mismo espacio**. | Un docente podria reservar 3 h en cada uno de tres espacios contiguos (9 h en total) sin dejar de cumplir la regla. |
| **B (por usuario y fecha)** | El limite se aplica a la **union de todas las reservas de un usuario en una fecha**, con independencia del espacio. | Se limitan los bloques continuos reservados por una misma persona, sin importar en que espacios. |

**Decision: se adopta la lectura B**, por tres motivos:

1. El sujeto de la norma es la persona usuaria ("ningun usuario podra..."), no el espacio. Si el limite fuera por espacio, la regla diria "no se podra reservar un espacio durante mas de cuatro horas consecutivas".
2. La lectura B **contiene** a la lectura A: si un mismo espacio queda bloqueado mas de 4 h seguidas, tambien se supera el limite global. Ninguna reserva que viola la lectura A escapa a la lectura B.
3. La lectura B satisface la intencion de fondo de la institucion (uso equitativo de los recursos). La lectura A admite unabusodeclarado.

La lectura B se implementa calculando la **union de los intervalos** de las reservas del usuario en la fecha, no la suma de sus duraciones. La distincion es importante: un docente con una reserva de 08:00-12:00 y otra de 13:00-15:00 tiene 6 horas reservadas pero **ningun bloque continuo de mas de 4 horas**, por lo que la reserva es valida. Solo se bloquea cuando existe un **bloque continuo** superior a 240 minutos.

Esta decision queda documentada en `design.md` (decision D5) y es objeto de un escenario de aceptacion explicito que fija el comportamiento.

### 4. Regla de precedencia

El limite de duracion se evalua **antes** del calculo de horas consecutivas, y ambos antes de la comprobacion de disponibilidad. El orden completo queda:

```
1. Existencia del espacio (404) y estado activo (409)
2. Coherencia de la franja y de la fecha (422)
3. DURACION_MAXIMA: duracion de la reserva <= 240 min (422 DURACION_EXCEDIDA)
4. Anticipacion minima (422 ANTICIPACION_INSUFICIENTE)
5. Encaje en el horario del espacio (422 FUERA_DE_HORARIO)
6. Numero de asistentes frente a la capacidad (422 CAPACIDAD_EXCEDIDA)
7. HORAS_CONSECUTIVAS: union de intervalos del usuario en la fecha <= 240 min (422 HORAS_CONSECUTIVAS_EXCEDIDAS)
8. Disponibilidad de la franja (409 ESPACIO_OCUPADO)
```

El computo de las horas consecutivas se realiza **dentro de la transaccion `IMMEDIATE`**, junto con la verificacion de disponibilidad, para que el computo y la insercion sean atomicos: dos solicitudes simultaneas del mismo usuario sobre franjas contiguas no pueden ambas prosperar.
