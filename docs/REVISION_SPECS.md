# Revisión de Especificaciones — Fase 2 de la ETAPA 2

**Change revisado:** `add-core-reservation-system`
**Fecha de la revisión:** posterior al commit `spec(specs): FASE 1`
**Método:** lectura cruzada de las 8 especificaciones contra `PLAN_INGENIERIA.md`, contra el catálogo de errores y contra el modelo de dominio implícito; verificación con `openspec validate --strict`.

---

## 1. Resultado del chequeo automático

```
$ openspec validate add-core-reservation-system --strict
Change 'add-core-reservation-system' is valid
```

El validador comprueba la forma (encabezados `### Requirement:`, escenarios `#### Scenario:`, sintaxis WHEN/THEN, longitud de las descripciones). **No** comprueba la coherencia semántica entre capacidades, que es exactamente lo que esta revisión cubre.

---

## 2. Correspondencia con `PLAN_INGENIERIA.md`

| Necesidad del plan (§1.2) | Capacidad OpenSpec | Requisitos | Estado |
|---|---|---|---|
| N1 Gestionar espacios | `space-management` | 5 | Cubierta |
| N2 Registrar y administrar usuarios | `user-management` | 6 | Cubierta |
| N3 Roles y permisos | `rbac` | 5 | Cubierta |
| N4 Crear solicitudes de reserva | `reservation-management` | 8 | Cubierta |
| N5 Validar disponibilidad | `availability` | 4 | Cubierta |
| N6 Prevenir reservas simultáneas | `reservation-management` | 2 | Cubierta |
| N7 Aprobar y rechazar | `reservation-approval` | 6 | Cubierta |
| N8 Cancelar e historial | `reservation-management` + `reservation-history` | 1 + 4 | Cubierta |
| N2 Autenticación | `auth` | 6 | Cubierta |
| NN2 Consistencia bajo concurrencia | `reservation-management` | 1 (atomicidad) | Cubierta |
| NN3 Determinismo y auditabilidad | `reservation-history` | 2 | Cubierta |

Las 8 capacidades exigidas por el enunciado están presentes. Ninguna capacidad del plan quedó sin especificar.

---

## 3. Hallazgos y correcciones aplicadas

Se identificaron **10 hallazgos**. Todos se corrigieron en los archivos de delta de la especificación **antes** de escribir una línea de implementación, conforme a la restricción "no se permite desarrollar funcionalidades cuya especificación no haya sido revisada".

### H-01 · CRÍTICO · Contradicción: el registro público permite elegir el rol

- **Dónde:** `auth` → *Registro público de usuario*vs. `user-management` → *Alta de usuario por administrador*.
- **Problema:** la especificación de `auth` decía que el registro público acepta un `rol`, lo que permitiría que cualquiera se auto-asignase el rol `ADMIN`. La especificación de `user-management` por su parte YA establecía que el alta con rol corresponde a un usuario con `usuarios:escribir`. Dos mecanismos contradictorios para el mismo control, con un hueco de autorización explícito.
- **Resolución:** el registro público **siempre** asigna el rol `ESTUDIANTE` y rechaza cualquier `rol` distinto con `422 ROL_NO_PERMITIDO`. La asignación de rol queda exclusivamente en `user-management`.
- **Estado:** CORREGIDO.

### H-02 · CRÍTICO · Contradicción: el rol dentro del token vs. el rol vigente

- **Dónde:** `auth` → *Emision y expiracion del token de sesion* vs. `rbac` → *Verificacion efectiva de permisos*.
- **Problema:** `auth` indicaba que el token contenía "su rol", mientras que `rbac` exigía que el permiso se evaluase "con el rol vigente del usuario en el momento de la petición". Con el rol embebido en el token, un cambio de rol no surte efecto hasta que expire el token, contradiciendo el escenario de `rbac`.
- **Resolución:** el token contiene **únicamente** el identificador del usuario y su versión de token. El rol y los permisos se resuelven desde la base de datos en cada petición, de modo que un cambio de rol surte efecto inmediato (escenario ya presente en `rbac`, ahora verificable).
- **Estado:** CORREGIDO.

### H-03 · ALTO · Requisito engañoso: "Protección contra fuerza bruta" sin mecanismo

- **Dónde:** `auth` → *Proteccion contra fuerza bruta*.
- **Problema:** el requisito solo exigía registrar los intentos fallidos, pero el título prometía protección. La especificación era ambigua: un evaluador podría esperar un bloqueo de fuerza bruta que la implementación no tendría.
- **Resolución:** se implementa el bloqueo real y se hace verificable: tras **5 intentos fallidos** en una ventana de **15 minutos** para el mismo correo, el sistema responde `429 DEMASIADOS_INTENTOS`. Se renombra el requisito a *Limite de intentos de inicio de sesion* y se anaden los escenarios de bloqueo y de restablecimiento tras la ventana.
- **Estado:** CORREGIDO.

### H-04 · ALTO · Hueco funcional: la capacidad del espacio nunca se usaba

- **Dónde:** `space-management` (define `capacidad`) vs. `reservation-management` (no la menciona).
- **Problema:** el plan define la capacidad como atributo del espacio (N1), pero ninguna regla la usaba. Un atributo sin uso es una señal de requisito incompleto: la institucion reserva auditorios y salas con aforo limitado, y sin validación cualquier solicitud puede "reservar" un espacio con 20 plazas para 200 personas.
- **Resolución:** `reservation-management` incorpora el requisito *Numero de asistentes frente a la capacidad del espacio*: el campo `asistentes` es opcional, debe ser un entero mayor que cero y, si se indica, no puede superar la capacidad del espacio (`422 CAPACIDAD_EXCEDIDA`).
- **Estado:** CORREGIDO.

### H-05 · MEDIO · Ambigüedad: qué error prevalece cuando se incumplen varias reglas

- **Dónde:** `reservation-management` → *Validacion de la coherencia de la franja* y *Anticipacion minima de la solicitud*.
- **Problema:** una reserva de ayer incumple a la vez "fecha en el pasado" y "anticipación insuficiente". La especificación no decía qué código de error debía devolver la API, de modo que dos implementaciones conformes con la spec podrían responder distinto. Es el tipo de ambigüedad que rompe la trazabilidad requisito→prueba.
- **Resolución:** se fija explícitamente el **orden de validación** (existencia del espacio → coherencia de la franja y fecha → anticipación → encaje en el horario → disponibilidad) y se anade el escenario que verifica que una fecha pasada produce `422 VALIDACION` y no `ANTICIPACION_INSUFICIENTE`.
- **Estado:** CORREGIDO.

### H-06 · MEDIO · Contradicción de contrato: formato de las colecciones

- **Dónde:** `user-management` (menciona paginación) vs. `reservation-management` (no la menciona) vs. `space-management` y `availability` (no la mencionan).
- **Problema:** cada especificación usaba un envelope de respuesta distinto o implícito. Una API con cuatro formatos de lista es inconsistente y fuerza a la UI a escribir cuatro adaptadores.
- **Resolución:** se define un **envelope único** para toda colección: `{ "datos": [...], "total": <n>, "pagina": <n>, "limite": <n> }`, con `pagina` por defecto 1 y `limite` por defecto 20 (máximo 100), y se aplica a las cuatro capacidades que devuelven colecciones.
- **Estado:** CORREGIDO.

### H-07 · MEDIO · Ambigüedad: consulta de un espacio por identificador o por código

- **Dónde:** `space-management` → *Consulta de un espacio*.
- **Problema:** el requisito decía "por su identificador o por su codigo" sin indicar si es el mismo endpoint o dos, lo que deja abierto el contrato de la API.
- **Resolución:** `GET /api/espacios/:referencia` acepta tanto el identificador numérico como el código alfanumérico; se anaden los dos escenarios correspondientes.
- **Estado:** CORREGIDO.

### H-08 · MEDIO · Hueco de seguridad: el administrador puede desactivarse a sí mismo

- **Dónde:** `user-management` → *Actualizacion de datos y rol de un usuario*.
- **Problema:** se impedía quitarse el propio rol `ADMIN`, pero nada impedía desactivar la propia cuenta, lo que dejaría el sistema sin ningún administrador operativo y sin vía de recuperación por la API.
- **Resolución:** se extiende la prohibición a la auto-desactivación, con el mismo código `409 AUTOMODIFICACION_PROHIBIDA`, y se anade el escenario.
- **Estado:** CORREGIDO.

### H-09 · BAJO · Ambigüedad: filtro por solicitante en la consulta de reservas

- **Dónde:** `reservation-management` → *Consulta de reservas*.
- **Problema:** se ofrecía un filtro por solicitante, pero no se decía qué ocurre cuando un `DOCENTE` o `ESTUDIANTE` lo usan: ¿ven la reserva de otro usuario o el filtro se ignora?
- **Resolución:** los roles `DOCENTE` y `ESTUDIANTE` solo reciben sus propias reservas con independencia del filtro; el filtro por solicitante solo es efectivo para `ADMIN` y `COORDINADOR`. Escenario añadido.
- **Estado:** CORREGIDO.

### H-10 · BAJO · Ambigüedad: prevalencia del horario del espacio

- **Dónde:** `space-management` (atributos de horario) vs. `reservation-management` → *Encaje dentro del horario del espacio*.
- **Problema:** el sistema tiene un horario por defecto configurable y cada espacio tiene además su propio horario. No quedó claro cuál manda.
- **Resolución:** el horario **del espacio** prevalece siempre; el valor por defecto del sistema solo se aplica en el momento de crear el espacio. Escenario añadido en `space-management`.
- **Estado:** CORREGIDO.

---

## 4. Decisiones de la revisión que NO se cambiaron (y su motivo)

| Decisión revisada | Motivo de conservarla |
|---|---|
| `availability` responde `409 ESPACIO_INACTIVO` al consultar un espacio inactivo | Es una consulta de **reservabilidad**, no un listado. Un espacio desactivado no admite reservas, y el `409` lo comunica de forma inequívoca. Además, la desactivación está bloqueada mientras existan reservas activas, por lo que la respuesta no oculta información de agenda. |
| Las franjas que se tocan en un extremo **no** se consideran solapadas | Semántica de intervalos semiabiertos `[inicio, fin)`. Es la convención estándar en agenda y evita rechazar reservas legítimas de 09:00-10:00 y 10:00-11:00. Se documentó como escenario explícito (`Franjas contiguas permitidas`). |
| El registro público asigna `ESTUDIANTE` | Toda persona de la institución necesita poder solicitar espacios sin intervención administrativa. El rol `ESTUDIANTE` es el de menor privilegio y el ADMIN puede promoverlo después. |
| El cierre de sesión invalida **todos** los tokens del usuario | No hay almacén de sesiones ni lista de revocados; invalidar por versión es más simple de operar y suficiente para el perfil de uso. Costo aceptado: el usuario debe volver a iniciar sesión en todos sus dispositivos. |
| Una reserva no cruza medianoche | Fuera del modelo temporal actual. Se declara como limitación L1 en el plan y se mitigate con la regla de "una misma fecha civil" en la validación. |

---

## 5. Verificación posterior a las correcciones

```
$ openspec validate add-core-reservation-system --strict
Change 'add-core-reservation-system' is valid

$ openspec list --specs
(add-core-reservation-system) 8 capacidades declaradas en la propuesta
```

- Requisitos totales: **44**
- Escenarios de aceptación totales: **104**
- Capacidades: **8**
- Hallazgos corregidos: **10**
- Hallazgos pendientes: **0**

La especificación queda **aprobada para implementación**. El diseño técnico (`design.md`) y el plan de trabajo (`tasks.md`) de este mismo change se construyen a partir de la versión corregida.
