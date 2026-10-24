# Informe Final

**Proyecto:** SIGREA — Sistema de Gestión de Reservas de Espacios Académicos
**Modalidad:** Individual
**Metodología:** Spec-Driven Development (SDD) con OpenSpec, asistido por un agente de IA de programación
**Etapas:** ETAPA 1 (Planificación de ingeniería) y ETAPA 2 (Desarrollo mediante SDD y OpenSpec)

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Resultados frente a los objetivos](#2-resultados-frente-a-los-objetivos)
3. [Análisis de resultados por etapa](#3-análisis-de-resultados-por-etapa)
4. [Trazabilidad del proceso en Git](#4-trazabilidad-del-proceso-en-git)
5. [Decisiones técnicas que cambiaron durante el desarrollo](#5-decisiones-técnicas-que-cambiaron-durante-el-desarrollo)
6. [Problemas encontrados al transformar la propuesta en especificaciones](#6-problemas-encontrados-al-transformar-la-propuesta-en-especificaciones)
7. [Cómo se evitó que la IA implementara funcionalidades incorrectas](#7-cómo-se-evitó-que-la-ia-implementara-funcionalidades-incorrectas)
8. [Dificultades encontradas](#8-dificultades-encontradas)
9. [Verificación de requisitos y escenarios de aceptación](#9-verificación-de-requisitos-y-escenarios-de-aceptación)
10. [Cambio de negocio: la regla de las 4 horas](#10-cambio-de-negocio-la-regla-de-las-4-horas)
11. [Limitaciones conocidas y trabajo futuro](#11-limitaciones-conocidas-y-trabajo-futuro)
12. [Conclusiones sobre el uso de SDD con OpenSpec](#12-conclusiones-sobre-el-uso-de-sdd-con-openspec)
13. [Respuestas a las preguntas de sustentación](#13-respuestas-a-las-preguntas-de-sustentación)

---

## 1. Resumen ejecutivo

El proyecto resuelve el problema central de la institución: **la ausencia de una fuente única de verdad con integridad transaccional** para las reservas de espacios académicos. No se trata de digitalizar el correo electrónico, sino de trasladar las reglas de integridad del plano de la coordinacion interpersonal al plano de la transaccion al plano de la transacción de base de datos.

El sistema entregado (SIGREA) es una aplicación web completa con API REST, interfaz web operativa, persistencia relacional, control de acceso por roles y permisos, bitácora auditable y **214 pruebas automatizadas** (93 % de cobertura de líneas, 82 % de ramas).

El resultado más relevante del proceso no es el código, sino la **evidencia de un ciclo de desarrollo gobernado por especificaciones**: 47 requisitos, 116 escenarios de aceptación, 11 correcciones documentales aplicadas antes de implementar y 2 changes de OpenSpec archivados, todo ello con un historial de Git que demuestra el orden plan → especificación → revisión → implementación → gestión de cambios.

| Entregable | Estado | Ubicación |
|---|---|---|
| `PLAN_INGENIERIA.md` | Completo (700 líneas) | Commit `5976c47` (independiente) |
| Directorio de OpenSpec | 8 capacidades vigentes + 2 changes archivados | `openspec/` |
| Código fuente funcional | 43 archivos TypeScript en `src/` | `src/` |
| Pruebas automatizadas | 214 pruebas, 12 archivos | `tests/` |
| `README.md` | Completo (instalación, configuración, ejecución, API) | `README.md` |
| `INFORME_FINAL.md` | Este documento | `INFORME_FINAL.md` |
| Documentación de apoyo | Revisión de specs, matriz de trazabilidad | `docs/` |

---

## 2. Resultados frente a los objetivos

### 2.1 Objetivo general

> "Aplicar principios de ingeniería de software mediante la planificación técnica de una solución y su posterior desarrollo utilizando SDD con OpenSpec, garantizando la trazabilidad entre las decisiones de ingeniería, las especificaciones, el código y las pruebas."

**Cumplido.** La trazabilidad es literal y auditable:

```
PLAN_INGENIERIA.md  ->  openspec/specs/<capacidad>/spec.md  ->  src/<módulo>/  ->  tests/<archivo>.test.ts
     (8 necesidades)         (47 requisitos / 116 escenarios)      (43 archivos)       (214 pruebas)
```

La matriz [`docs/TRAZABILIDAD.md`](docs/TRAZABILIDAD.md) contiene una fila por requisito con las cuatro columnas. **Ninguna fila queda sin prueba asociada.**

### 2.2 Objetivos específicos

| Objetivo | Resultado | Verificación |
|---|---|---|
| Centralizar las reservas | 8 capacidades operativas en un único servicio | Suite de integración de la API |
| Eliminar la duplicidad de solicitudes | Control de solapamiento transaccional | `buscarSolapadas` + prueba de concurrencia |
| Eliminar los conflictos de horarios | `BEGIN IMMEDIATE` + verificación e inserción inseparables | Prueba de dos peticiones concurrentes |
| Facilitar la consulta de disponibilidad | Endpoint con franjas ocupadas y libres | 10 pruebas de disponibilidad |
| Garantizar trazabilidad de las decisiones | Plan, addendum, 2 designs, revisión de specs, informe | `git log` con 12 commits trazables |
| Verificar requisitos de forma automatizada | 214 pruebas, todas verdes | `npm run verify` |

---

## 3. Análisis de resultados por etapa

### 3.1 ETAPA 1 — Planificación de ingeniería

**Resultado:** documento de 700 líneas que cubre los seis apartados exigidos y **anticipa 10 riesgos** con su mitigación.

Lo que resultó más útil del plan, a la luz de la experiencia posterior:

- **El modelo temporal** (`fecha` civil + `hora` local) resultó ser la decisión que hizo barato el computo de la regla de 4 horas. Si se hubiera elegido un `TIMESTAMP` UTC, la union de intervalos habria exigido conversiones en cada comparacion y la regla nueva habria sido mas costosa de implementar.
- **El indice `reservas(usuario_id, fecha)`** que se creo para el filtro por solicitante SIRVIO para la regla de horas consecutivas, sin necesidad de indice nuevo.
- **La transaccion `IMMEDIATE`** se documentoó por el solapamiento, pero resulto ser la garantia que hace posible tambien el computo atomico de las horas consecutivas.
- **La comparacion de seis decisiones tecnicas** (monolito modular, SQLite, SQL sin ORM, JWT, Vitest, SPA nativa) resulto directamente util: cinco de las seis se mantuvieron sin revision y solo una (la de copiar los assets en el build) resulto incompleta en su justificacion.

**Lo que el plan NO acertó a prever:**

| No previsto | Impacto | Resolucion |
|---|---|---|
| El esquema SQL no se copia al compilar | `npm start` fallaba al arrancar | Se añadio `scripts/copiar-assets.mjs` al paso de build (commit `dca2e72`) |
| Las pruebas de anticipacion dependen de la zona horaria | Una prueba verde en Colombia fallaba en otra maquina | El reloj de negocio paso a ser hora civil local, no un instante UTC (decision D8 del design) |
| El codigo de espacio institucional lleva guiones (`LAB-101`) | La especificacion original los excluia | Se actualizo la especificacion ANTES del codigo (hallazgo H-11) |

### 3.2 ETAPA 2, Fase 1 — Construcción de especificaciones

**Resultado:** 8 capacidades, 47 requisitos, 116 escenarios de aceptacion. Cada requisito usa SHALL/MUST, describe un unico comportamiento y va acompanado de escenarios WHEN/THEN con codigos de error nominales.

La especificacion se escribio pensando en el **codigo de error como parte del contrato**, no como un detalle de implementacion. Eso permitio que las pruebas afirmen sobre `ESPACIO_OCUPADO` y no sobre un texto de mensaje, que es la parte inestable de cualquier contrato.

### 3.3 ETAPA 2, Fase 2 — Revisión de especificaciones

**Resultado:** 11 hallazgos, todos corregidos antes de implementar. La revision formal esta en [`docs/REVISION_SPECS.md`](docs/REVISION_SPECS.md).

Los dos hallazgos criticos merecen resaltarse porque habrian producido un sistema con fallos de seguridad reales:

| ID | Hallazgo | Correccion |
|---|---|---|
| H-01 | El registro publico permitia elegir el rol: cualquiera podia autoasignarse `ADMIN`. | El registro publico asigna siempre `ESTUDIANTE`; un rol distinto se rechaza con `422 ROL_NO_PERMITIDO`. |
| H-02 | El token JWT contenia el rol, pero `rbac` exigia que el permiso se evaluase con el rol vigente. Un cambio de rol no habria surtido efecto hasta que expirase el token. | El token transporta solo `sub` y `tv`; el rol y los permisos se resuelven desde la base de datos en cada peticion. |

Un hallazgo de alto nivel (H-03) consistio en descubrir que un requisito titulado "Proteccion contra fuerza bruta" solo exigia registrar los intentos fallidos. Se decidio **implementar el bloqueo real** (5 intentos en 15 minutos) en lugar de rebajar el titulo, porque la promises de proteccion sin mecanismo es una ambiguedad que habria produces un falso sentido de seguridad.

### 3.4 ETAPA 2, Fase 3 — Implementación

**Resultado:** 43 archivos TypeScript, 214 pruebas, cobertura del 93 % de lineas.

| Capa | Contenido | Patron |
|---|---|---|
| `src/domain/` | Reglas puras: tiempo, solapamiento, union y resta de intervalos, estados, errores | Sin dependencias |
| `src/shared/` | Configuracion, reloj de negocio, bus de eventos, paginacion | Sin dependencias |
| `src/db/` | Esquema, conexion, transaccion, 5 repositorios, semilla | Implementa los puertos |
| `src/modules/` | 8 modulos, cada uno con `domain/` y `application/` | Depende del dominio |
| `src/http/` | Middlewares, rutas, manejador de errores | Adapta HTTP a casos de uso |
| `src/container.ts` | Composicion de dependencias | Unico punto de cableado |
| `public/` | SPA sin build | Consume solo la API |

La estructura de modulos **coincide con los nombres de las capacidades de OpenSpec**, de modo que la correspondencia entre especificacion y codigo es visible en el arbol de archivos y no solo en la documentacion.

### 3.5 ETAPA 2, Fase 5 — Verificación

La verificacion se hizo en tres niveles:

1. **Automatizada:** `npm run verify` = typecheck + lint + 214 pruebas + validacion OpenSpec.
2. **Ejecucion real:** el sistema se arranco en modo produccion (`npm run build && npm start`) y se recorrio la API y la interfaz.
3. **Correspondencia:** revision manual de la matriz de trazabilidad contra el codigo.

---

## 4. Trazabilidad del proceso en Git

El historial es la evidencia principal de que se respeto la secuencia exigida:

```
7f0cfbc  feat(reservations): FASE 4 - implementa la regla de 4 horas consecutivas
c09e576  spec(change): FASE 4 - regla de 4 horas consecutivas (change de OpenSpec)
9585125  docs: matriz de trazabilidad y README del proyecto
dca2e72  fix(build): copiar el esquema SQL a dist en el paso de compilacion
7f10ace  test(api): pruebas de integracion del ciclo de vida de la reserva
c4532d2  test(api): pruebas de integracion de espacios y disponibilidad
3b6866b  test(api): pruebas de integracion de identidad, permisos y errores HTTP
1d118b9  test(dominio): pruebas unitarias de las reglas de negocio y la infraestructura
790490e  feat(ui): interfaz web operativa del sistema
3c37acf  feat(core): implementacion del dominio, persistencia y API REST
b6a6d32  spec(review): FASE 2 - revision de especificaciones, diseno tecnico y tareas
ea6dc08  spec(specs): FASE 1 - especificaciones de las 8 capacidades del sistema
e4250d7  chore(setup): configuracion base del proyecto e inicializacion de OpenSpec
5976c47  docs(plan): plan de ingenieria de software (ETAPA 1)          <-- INDEPENDIENTE
```

**Las tres condiciones de evaluacion se pueden comprobar directamente:**

| Condicion | Evidencia |
|---|---|
| El plan de ingenieria debe existir antes de las especificaciones | `5976c47` (plan) es antecesor de `ea6dc08` (specs) en la cadena lineal, sin ramas intermedias |
| Las especificaciones deben preceder a la implementacion | `ea6dc08` y `b6a6d32` son antecesores de `3c37acf` (implementacion) |
| Los cambios funcionales deben gestionarse mediante OpenSpec | `c09e576` (change con sus 4 artefactos) precede a `7f0cfbc` (implementacion del cambio) |

El commit `5976c47` contiene **unicamente** `.gitignore` y `PLAN_INGENIERIA.md`: el directorio `openspec/` no existia todavia.

---

## 5. Decisiones técnicas que cambiaron durante el desarrollo

| # | Decision inicial (PLAN_INGENIERIA) | Decision final | Motivo del cambio |
|---|---|---|---|
| 1 | El codigo de espacio es "alfanumerico en mayusculas" | Se admiten tambien guiones | Los codigos reales de la institucion (`LAB-101`, `AUD-MAIN`) los llevan. Se actualizo la especificacion **antes** del codigo (H-11). |
| 2 | El token JWT transporta el rol y la version | El token transporta solo `sub` y `tv` | Contradiccion detectada en la revision (H-02): con el rol embebido, un cambio de rol no surte efecto inmediato. |
| 3 | El registro publico acepta un rol opcional | El registro publico asigna siempre `ESTUDIANTE` | Huso de autorizacion (H-01). |
| 4 | "Proteccion contra fuerza bruta" = registrar intentos fallidos | Bloqueo real tras 5 intentos en 15 minutos | Requisito ambiguo (H-03): una promesa de proteccion sin mecanismo. |
| 5 | La capacidad del espacio es un atributo informativo | La capacidad limita el numero de asistentes de la reserva | Atributo sin uso (H-04): una auditoria de 200 plazas se podia "reservar" para 2000 personas. |
| 6 | El reloj del negocio es un instante UTC | El reloj del negocio es una hora civil local | Las pruebas de anticipacion dependian de la zona horaria de la maquina (riesgo R-09 del plan). |
| 7 | El historial consulta las reservas activas del usuario por espacio y fecha | Por fecha, con independencia del espacio | Requisito de la regla de 4 horas: el computo debe abarcar todos los espacios del usuario. |
| 8 | `npm run build` = `tsc` | `npm run build` = `tsc` + copia de assets | `schema.sql` no lo arrastra el compilador y se lee en tiempo de ejecucion. |
| 9 | Sin limite de duracion de reserva | Limite de 240 minutos por reserva y de bloque continuo por usuario | Regla de negocio solicitada por la institucion (Fase 4). |

**Ninguna decision de arquitectura de alto nivel (monolito modular, SQLite, SQL sin ORM, JWT, Vitest, SPA nativa) fue revertida.** Todas resistieron el cambio de negocio. Es un resultado relevante: la inversion en diseno se amortizo.

---

## 6. Problemas encontrados al transformar la propuesta en especificaciones

Se identificaron **11 problemas**, agrupados por naturaleza:

### 6.1 Contradicciones entre capacidades (3)

- **H-01 (critico):** dos mecanismos de alta de usuario con reglas de rol contradictorias.
- **H-02 (critico):** el contenido del token contradecía la exigencia de permisos vigentes.
- **H-07 (medio):** la consulta de un espacio "por identificador o por codigo" no fijaba el contrato de la API.

### 6.2 Requisitos ambiguos o promesas sin mecanismo (3)

- **H-03 (alto):** "Proteccion contra fuerza bruta" sin bloqueo real.
- **H-05 (medio):** no se decía que error prevalece cuando se incumplen varias reglas a la vez. Se fijo el **orden de validacion** completo.
- **H-09 (medio):** no se indicaba que ocurre si un `DOCENTE` filtra por solicitante ajeno.

### 6.3 Huecos funcionales (atributos o necesidades sin uso) (2)

- **H-04 (alto):** la `capacidad` del espacio no la usaba ninguna regla.
- **H-06 (medio):** cuatro formatos distintos de envoltura de coleccion.

### 6.4 Ambiguedades resolubles con un valor por defecto explicito (3)

- **H-08 (medio):** el administrador podia desactivarse a si mismo y dejar el sistema sin administrador.
- **H-10 (bajo):** no estaba claro si mandaba el horario del espacio o el valor por defecto del sistema.
- **H-11 (medio):** el codigo de espacio con guion (detectado durante la implementacion).

**Leccion principal:** las contradicciones mas graves (H-01 y H-02) no eran diferencias de redaccion entre requisitos, sino **dos reglas de negocio incompatibles en capacidades distintas**. Un validador de forma (`openspec validate --strict`) no las detecta: comprueba que cada requisito tenga estructura, no que el conjunto sea coherente. La revision manual resulto imprescindible.

---

## 7. Cómo se evitó que la IA implementara funcionalidades incorrectas

Las cinco barreras descritas en el plan (§6.4) se aplicaron, y el proceso genero **evidencia concreta** de que funcionaron:

| Barrera | Aplicacion real | Evidencia |
|---|---|---|
| **B1. Trazabilidad** | Cada requisito tiene fila en la matriz con su prueba | `docs/TRAZABILIDAD.md`, 47 filas, 0 huerfanas |
| **B2. Tipos** | TypeScript estricto con `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitReturns` | `npm run typecheck` sin errores; **detecto 24 errores de tipo** en la primera compilacion, todos en el codigo generado |
| **B3. Logica** | 214 pruebas, incluidas pruebas negativas por cada permiso (403) y cada estado invalido (409) y cada dato invalido (422) | `npm test` verde |
| **B4. Revision del diff** | El codigo generado se leyio contra la especificacion antes de commitear | Se detectaron y corrigieron: codigo de genero del error "no encontrado" (`RESERVA_NO_ENCONTRADO` en vez de `RESERVA_NO_ENCONTRADA`), `formatearHora(1440)` que no fallaba, y un parametro de funcion mal tipado |
| **B5. Conformidad OpenSpec** | `openspec validate --all --strict` antes de cada commit de implementacion | 8 elementos validos, 0 fallidos |

**Regla operativa que resulto mas eficaz:** *si una prueba falla, primero se duda de la especificacion y luego del codigo*. Isso resulto decisivo en tres casos concretos:

1. **H-11 (codigo de espacio con guion).** La prueba fallo con `422` ante un codigo `LAB-101`. La conclusion no fue "arreglar la prueba", sino "la especificacion es mas restrictiva que la realidad institucional". Se actualizo la especificacion primero.
2. **Escenario de concurrencia de la regla de 4 horas.** La prueba de concurrencia esperaba que solo una de dos solicitudes contiguas prosperase, y las dos prosperaron. El analisis MOSTRO que la especificacion estaba mal: las franjas del escenario (09:00-11:00 y 11:00-13:00) suman exactamente 4 horas, que es un caso valido. Se corrigio la especificacion y despues la prueba.
3. **Prueba de anticipacion dependiente de la zona horaria.** La prueba fallaba en unas maquinas y pasaba en otras. No se "arreglo" la prueba: se identifico que el modelo de tiempo del dominio debia ser hora civil local, se documento en el design y se ajusto el reloj de prueba.

En los tres casos, el defecto estaba en la especificacion o en el diseno, **no en el codigo generado**. Ese es el resultado que evidencia que la especificacion actuo como referencia real y no como decoracion.

---

## 8. Dificultades encontradas

### 8.1 Dificultades tecnicas

| Dificultad | Impacto | Resolucion |
|---|---|---|
| Expresar el solapamiento sin `EXCLUDE` de PostgreSQL | Alto: era el requisito critico | Condicion de intervalos semiabiertos en SQL + transaccion `IMMEDIATE`. Prueba de concurrencia que lo demuestra. |
| Que el computo de las horas consecutivas sea atomico | Alto: reintroducia una carrera | Calculo dentro de la misma transaccion `IMMEDIATE` (decision D3 del design del change) |
| Pruebas deterministas respecto del reloj | Medio | Puerto `Reloj` inyectable + hora civil local (decision D8) |
| Aislamiento de la base de datos en las pruebas | Medio | Base en memoria por archivo de prueba + reloj propio |
| `schema.sql` no llega a `dist/` | Medio (bloqueaba `npm start`) | Script de copia de assets encadenado al build |
| Mantener la envoltura de error unica en 22 rutas | Bajo | Middleware centralizado + pruebas que verifican la envoltura en todas las familias de error |

### 8.2 Dificultades de proceso

| Dificultad | Resolucion |
|---|---|
| Redactar especificaciones que no dependan de la implementacion | Regla aplicada: si un requisito puede cambiar sin cambiar el comportamiento observable, no pertenece a la spec. Se movieron los detalles al `design.md`. |
| Evitar la explosion combinatoria de escenarios | Regla de "un comportamiento por requisito": cada requisito declara una sola conducta y sus excepciones van en escenarios. |
| Mantener la correspondencia spec ↔ codigo ↔ prueba | La carpeta de cada modulo tiene el mismo nombre que la capacidad de OpenSpec; la matriz de trazabilidad se actualiza en cada etapa. |
| Distinguir "fallo del codigo" de "fallo de la especificacion" | Regla explicita de diagnostico contra el escenario de aceptacion; los tres casos ambiguos quedan documentados en este informe. |

### 8.3 Limitaciones del uso de la IA

| Limitacion | Como se mitigo |
|---|---|
| La IA produce codigo plausible pero no necesariamente correcto | Las 214 pruebas y los 24 errores de tipo fueron el filtro. |
| La IA tiende a "rellenar" requisitos ambiguos con su propia interpretacion | Se detecto en H-01 (autoasignacion de rol) y H-04 (capacidad sin uso): ambos requisitos habrian sido reinterpretados en silencio. |
| La IA no distingue "mismo comportamiento observable, distinta implementacion" | Regla explicita en el prompt de trabajo y en el `design.md`. |
| La IA puede desalinear el esquema de la base de datos respecto de la especificacion | El esquema se escribio antes que los repositorios, y el `CHECK` de cada columna refleja un requisito. |

---

## 9. Verificación de requisitos y escenarios de aceptación

### 9.1 Resultados de la verificación automatizada

```
$ npm run verify

> typecheck        tsc -p tsconfig.json --noEmit          -> sin errores
> lint             eslint .                                 -> sin errores
> test             vitest run                               -> 214 passed (12 archivos), 2,3 s
> openspec:validate openspec validate --all --strict       -> 8 passed, 0 failed
```

### 9.2 Cobertura

| Metrica | Valor | Umbral |
|---|---|---|
| Lineas | 93 % | 80 % |
| Ramas | 82 % | 80 % |
| Funciones | 97 % | 80 % |
| Sentencias | 93 % | 80 % |

Las reglas de negocio criticas (solapamiento, duracion, horas consecutivas, transiciones de estado) tienen **cobertura de rama completa**, verificado con `tests/unit/tiempo.test.ts` (25 pruebas) y `tests/integracion/reservas.test.ts` (40 pruebas).

### 9.3 Verificacion en ejecucion real

El sistema se arranco en modo produccion y se ejecuto un recorrido funcional:

| # | Verificacion | Resultado |
|---|---|---|
| 1 | `npm run db:migrate` + `db:seed` sobre base vacia | 4 usuarios, 6 espacios, 4 roles, 10 permisos |
| 2 | `npm run build` + `npm start` | `GET /api/health` -> `{"estado":"ok","baseDatos":"ok"}` |
| 3 | Inicio de sesion y perfil | Token emitido, rol correcto, sin hash de contrasena |
| 4 | Catalogo de espacios con filtro | 6 espacios, envelope con `datos`/`total`/`pagina`/`limite` |
| 5 | Disponibilidad de un espacio | Franjas ocupadas y libres coherentes |
| 6 | Creacion de reserva | `201`, estado `PENDIENTE`, evento en bitacora |
| 7 | Solapamiento | `409 ESPACIO_OCUPADO` con detalle de la franja en conflicto |
| 8 | Aprobacion por el administrador | `200`, estado `APROBADA`, actor registrado |
| 9 | Historial de la reserva | `RESERVA_CRIADA -> RESERVA_APROBADA` |
| 10 | Cancelacion y liberacion de la franja | `200 CANCELADA`, la franja vuelve a estar libre |
| 11 | Regla de 4 h: exactamente 4 h | `201` (aceptada) |
| 12 | Regla de 4 h: 4 h 01 min | `422 DURACION_EXCEDIDA` con la duracion solicitada y el maximo |
| 13 | Regla de 4 h: bloque continuo de 5 h por suma | `422 HORAS_CONSECUTIVAS_EXCEDIDAS` con el bloque `13:00 a 18:00` |
| 14 | Regla de 4 h: 4 h + hueco + 2 h | `201` (el hueco rompe la continuidad, no se acumula) |
| 15 | Regla de 4 h: reserva de otra persona | `409 ESPACIO_OCUPADO`, no `HORAS_CONSECUTIVAS_EXCEDIDAS` |

### 9.4 Correspondencia especificacion ↔ codigo

La revision manual de la matriz de trazabilidad (`docs/TRAZABILIDAD.md`) contra el codigo no encontro requisitos sin implementacion ni comportamientos implementados sin requisito. Los tres casos en que la correspondencia **no** era directa se documentaron como decisiones explicitas en el `design.md`:

1. La separacion de funciones (el solicitante no aprueba su propia reserva) se implementa en el caso de uso y no como un permiso, porque depende de la relacion entre la reserva y el actor y no del rol.
2. El registro publico de usuarios se implementa en el modulo `auth` (no en `user-management`), porque es una operacion anonima con su propia regla de rol; el alta con rol asignable vive en `user-management`.
3. La bitacora se escribe mediante un bus de eventos en memoria invocado dentro de la transaccion de negocio, y no con llamadas explicitas en cada caso de uso.

---

## 10. Cambio de negocio: la regla de las 4 horas

### 10.1 El proceso seguido

| Paso | Artefacto | Commit |
|---|---|---|
| 1. Analizar el impacto | `proposal.md` con 6 secciones del plan afectadas, analisis tecnico y resolucion de la ambiguedad | `c09e576` |
| 2. Revisar el plan de ingenieria | Capitulo 9 (addendum) de `PLAN_INGENIERIA.md` | `7f0cfbc` |
| 3. Actualizar las especificaciones | Delta OpenSpec: 1 requisito MODIFIED + 3 ADDED, 12 escenarios nuevos | `c09e576` |
| 4. Definir escenarios de aceptacion | 12 escenarios, incluidos 2 casos limite y 1 de concurrencia | `c09e576` |
| 5. Implementar | 2 reglas de validacion + generalizacion de una consulta | `7f0cfbc` |
| 6. Crear/actualizar pruebas | 23 pruebas nuevas (19 de integracion + 4 unitarias) | `7f0cfbc` |
| 7. Verificar no regresion | 214 pruebas verdes **sin modificar ninguna prueba existente** | `7f0cfbc` |

**La secuencia se respeta de forma literal:** el commit `c09e576` contiene la especificacion y no toca `src/`; el commit `7f0cfbc` contiene el codigo y las pruebas. Es comprobable con `git show --stat`.

### 10.2 La ambiguedad y su resolucion

El enunciado "ningun usuario podra reservar un espacio academico durante mas de cuatro horas consecutivas" admite dos lecturas:

- **A (por espacio):** el limite aplica a las reservas de un usuario **en un mismo espacio**.
- **B (por usuario y fecha):** el limite aplica a la **union de todas las reservas del usuario en una fecha**, con independencia del espacio.

Se adopto la **lectura B**, por tres razones documentadas:

1. El sujeto de la norma es la persona ("ningun usuario podra..."), no el espacio.
2. La lectura B **contiene** a la lectura A: ninguna combinacion que vulnere A escapa a B.
3. La lectura A admite un abuso evidente (3 h en cada uno de tres espacios contiguos).

La lectura B se implementa sobre la **union de los intervalos**, no sobre la suma de duraciones. La distincion es sustantiva y esta verificada por prueba: un docente con 08:00-12:00 y 13:00-15:00 (6 horas reservadas) **puede** reservarlas, porque ningun bloque continuo supera las 4 horas.

### 10.3 Lo que el cambio confirmo del plan

El addendum del capitulo 9 detalla el impacto sobre **11 secciones del plan** y llega a una conclusion notable: **ninguna decision tecnica del plan resulto invalida**. El modelo temporal, el indice `(usuario_id, fecha)`, la transaccion `IMMEDIATE` y la reutilizacion de las reglas puras del dominio son, en todos los casos, lo que hace que la regla sea barata y segura de implementar.

El unico ajuste material es de alcance funcional (la necesidad N9) y un riesgo nuevo (R-11: la regla puede frenar a un docente con agenda fragmentada).

### 10.4 Deuda documentada

Tres aspectos que la regla **no** resuelve, y que se dejan explicitos para la institucion:

1. **No se revalidan las reservas ya existentes.** Revalidarlas exigiria definir que hacer con ellas (dejar, recortar, cancelar), que es una politica de negocio que la institucion no ha especificado.
2. **No hay excepcion por rol.** Un coordinador que organiza un evento institucional de 6 horas no tiene una excepcion. Es un change nuevo si se requiere.
3. **El limite es global.** No distingue por edificio, area ni tipo de espacio.

---

## 11. Limitaciones conocidas y trabajo futuro

### 11.1 Limitaciones tecnicas aceptadas

| ID | Limitacion | Motivo | Mitigacion / plan |
|---|---|---|---|
| L1 | Un solo escritor en SQLite | Sin servidor de base de datos en la institucion | Puerto `ReservationRepository` permite migrar a PostgreSQL + `EXCLUDE` sin tocar el dominio |
| L2 | El limite de intentos de login es por proceso | Sin almacen compartido | Se acepta en el despliegue de una instancia; documentado |
| L3 | El token vive en `localStorage` | App interna sin contenido de terceros | No se inserta HTML desde el servidor (todo el DOM usa `textContent`) |
| L4 | La base de datos es un archivo unico | Despliegue sin infraestructura | Modo WAL, `synchronous = FULL`, `integrity_check` en el health-check, script de respaldo |
| L5 | Sin notificaciones por correo | No hay SMTP institucional | Tabla `eventos` como punto de extension; interfaz `Notificador` documentada |
| L6 | Sin integracion con calendarios externos | Requiere credenciales de terceros | El modelo temporal ya es compatible con iCal |
| L7 | Sin auditoria por rango de fechas en la UI | No era requisito | El endpoint ya soporta `desde` y `hasta` |

### 11.2 Trabajo futuro priorizado

| Prioridad | Elemento | Valor |
|---|---|---|
| Alta | Excepcion por rol para eventos institucionales | Necesaria en la practica para coordinadores |
| Alta | Panel de estadisticas de uso por espacio y docente | Responde al defecto D3 del problema original (consultas costosas) |
| Media | Exportacion de la agenda en iCal | Integracion con calendarios personales |
| Media | Notificacion por correo al aprobar o rechazar | Cierra el ciclo de comunicacion |
| Media | Politica de revalidacion de reservas existentes | Necesaria si se quiere aplicar la regla al historico |
| Baja | Autenticacion corporativa (LDAP/SSO) | Conveniencia institucional |
| Baja | Multi-sede | Solo si la institucion crece |

---

## 12. Conclusiones sobre el uso de SDD con OpenSpec

### 12.1 Ventajas verificadas

**1. La especificacion se convierte en un detector de contradicciones antes de que el codigo las materialice.** Los dos hallazgos criticos (H-01, H-02) se detectaron por escrito, antes de existir una linea de codigo. Si se hubieran detectado con el sistema en marcha, la correccion habria afectado al esquema de tokens, al middleware de autenticacion y al modulo de usuarios: tres capas. En el momento de la revision eran tres frases.

**2. La revision previa es donde mas valor se genera.** De los 11 hallazgos, ninguno era un error de sintaxis: todos eran de **semantica del negocio**. El trabajo de "convertir una propuesta en escenarios verificables" es, en si mismo, un ejercicio de ingenieria de requisitos, y produce mas valor que la validacion automatica.

**3. La gestion de cambios deja un rastro legible.** El change `limit-4-horas-consecutivas` esta archivado con sus cuatro artefactos: propuesta, delta de especificacion, decisiones tecnicas y lista de tareas. Cualquiera puede responder, sin preguntar a nadie, por que la regla se computa sobre la union de intervalos y no sobre la suma, o por que no se revalidan las reservas historicas.

**4. La trazabilidad deja de ser declarativa.** No basta con decir "cada requisito tiene una prueba": la matriz lo demuestra requisito por requisito, con los cuatro enlaces.

**5. Reduce el coste de revisar codigo generado.** Un revisor que dispone de "el comportamiento esperado, con sus codigos de error y sus casos limite" revisa mucho mas rapido que uno que solo lee el diff. En este proyecto, la revision se centro en contradicciones *entre* requisitos, no en buscar errores de codigo.

**6. Los limites del proceso quedan visibles antes de que cuesten.** En la Fase 4, el analisis de impacto revelo que la regla no requiere cambios de esquema: eso se pudo comprobar ANTES de implementar, no despues.

### 12.2 Limitaciones verificadas

**1. OpenSpec valida la forma, no el sentido.** `openspec validate --strict` comprueba que cada requisito tenga estructura y escenarios, y que el cambio tenga deltas coherentes. No detecta que dos capacidades se contradigan (H-01, H-02) ni que un atributo no se use (H-04). **La revision manual sigue siendo obligatoria**: la parte que mas valor aporta es la que ninguna herramienta hace.

**2. Escribir especificaciones consume tiempo que no es "codigo".** En este proyecto, las ocho capacidades occupied entre la propuesta, los ocho `spec.md`, el `design.md` y las tareas un volumen de especificacion superior al del codigo de los casos de uso. Es una inversion que se justifica por la reduccion de retrabajo, pero es real.

**3. Las especificaciones envejecen.** Un requisito redactado con una frase ambigua produce una implementacion ambigua, y el coste de arreglarlo es mayor que el de redactarlo bien. La especificacion es un **activo que hay que cultivar**: cuando se detecto H-11 (codigo con guion), la actualizacion fue de una linea, pero solo porque el requisito estaba localizado en un unico archivo.

**4. El archivado crea un orden que hay que entender.** Los deltas se aplican sobre la especificacion vigente en el momento del archivado. Archivar el sistema base antes de proponer el cambio de las 4 horas fue una decision consciente, sin la cual el delta se habria escrito contra una capacidad que aun no existia como especificacion. El flujo de OpenSpec lo resuelve, pero exige comprender el ciclo.

**5. La disciplina no es automatico.** Es facil escribir la especificacion despues del codigo, aunque el repositorio lo haga visible. Lo que sostiene el proceso es la **voluntad de no tocar `src/` sin una especificacion que lo autorice**, y esa es una decision del estudiante, no de la herramienta.

### 12.3 Conclusion

**SDD con OpenSpec resulto mas-appropriate para este problema que el desarrollo basado unicamente en instrucciones directas a una IA**, por una razon concreta: el problema central de la institucion (evitar el solapamiento) es un problema de **integridad de datos**, no de logica de negocio complexa. La logica de negocio se puede pedir a una IA en una frase. La integridad de datos exige:

1. Un modelo de estados explicito (4 estados y 6 transiciones validas, con `409` en las invalidas).
2. Una invariante expresada en la base de datos (indice, `CHECK`, FK).
3. Una transaccion que haga inseparables la verificacion y la escritura.
4. Una especificacion que fije los casos limite (franjas que se tocan, duraciones exactas, concurrencia).

Un agente de IA puede producir los cuatro, pero **solo tiene un criterio fiable sobre cual es el comportamiento correcto si ese comportamiento esta escrito y es verificable**. La especificacion es, en la practica, el mecanismo que convierte una instruccion ambigua en un contrato verificable.

---

## 13. Respuestas a las preguntas de sustentación

### 1. ¿Qué decisiones de ingeniería tomó antes de comenzar a programar?

Seis decisiones de arquitectura, cada una comparada con al menos una alternativa descartada (`PLAN_INGENIERIA.md` §3.4):

| Decision | Elegido | Descartado |
|---|---|---|
| Estructura | Monolito modular en capas | Microservicios (la transaccion distribuida complica justamente el requisito critico); monolito en capas horizontales (reglas de negocio dispersas) |
| Persistencia | SQLite embebido, SQL parametrizado | PostgreSQL (mejor tecnicamente para `EXCLUDE`, pero exige infraestructura que no existe); MySQL; Prisma y TypeORM (opacidad en la condicion de solapamiento) |
| Identidad | JWT stateless con version de token | Sesiones en servidor (exige store compartido); tokens opacos |
| Pruebas | Vitest + Supertest | Jest (friccion con ESM/TypeScript); pruebas manuales (no cumple el entregable) |
| Interfaz | SPA nativa sin build | React/Vite (toolchain sin aporte); solo API (la institucion no podria adoptarlo) |
| Modelo temporal | Fecha civil + hora local | `TIMESTAMP` UTC (conversiones en cada comparacion) |

Ademas: transaccion `IMMEDIATE` para la exclusion mutua, RBAC normalizado con matriz de permisos, reloj de negocio inyectable, y bus de eventos para la bitacora.

### 2. ¿Qué problemas identificó al transformar su propuesta en especificaciones?

Once. Tres fueron contradicciones entre capacidades (autoasignacion de rol en el registro publico; el rol dentro del token frente al rol vigente; el contrato de consulta de un espacio), tres fueron requisitos ambiguos (proteccion contra fuerza bruta sin mecanismo; que error prevalece al incumplir varias reglas; el efecto del filtro por solicitante para los roles sin visibilidad global), dos fueron huecos funcionales (la capacidad del espacio no la usaba ninguna regla; cuatro envolturas de coleccion distintas), dos fueron problemas de seguridad y consistencia (el administrador podia desactivarse a si mismo; la prevalencia del horario del espacio) y uno fue una discrepancia con la realidad institucional (el codigo de espacio con guion). Todos estan documentados con su resolucion en `docs/REVISION_SPECS.md`.

### 3. ¿Cómo evitó que la IA implementara funcionalidades incorrectas?

Con cinco barreras en cascada (trazabilidad, tipos, logica, revision del diff y conformidad OpenSpec) y, sobre todo, con una **regla de diagnostico**: cuando una prueba falla, primero se duda de la especificacion y luego del codigo. Funciono de forma verificable en tres casos: el codigo con guion (fallo de especificacion), el escenario de concurrencia mal redactado (fallo de especificacion) y la dependencia de zona horaria (fallo de diseno). En ninguno de los tres se "arreglo la prueba" para hacerla pasar. Ademas, la especificacion exigia codigos de error nominales, de modo que las pruebas afirmaban sobre el contrato y no sobre un mensaje.

### 4. ¿Qué diferencias encontró entre su planificación inicial y la implementación final?

| Tipo | Diferencias |
|---|---|
| **Decisiones revertidas** | Ninguna de las seis decisiones de arquitectura. |
| **Decisiones ajustadas** | Cinco: codigo de espacio con guiones; contenido del token; rol del registro publico; alcance real de la "proteccion contra fuerza bruta"; uso de la capacidad del espacio. |
| **Decisiones nuevas** | Tres: el codigo de error del recurso no encontrado necesita un catalogo explicito por genero; el reloj de negocio debe ser hora civil local, no instante UTC; el build debe copiar los assets no-TypeScript. |
| **Alcance ampliado** | La regla de las 4 horas, que el plan no preveia y que el planificacion habia anticipado en su ejemplo de transformacion (plan §6.2). |
| **Deuda no prevista** | La revalidacion de reservas historicas, la excepcion por rol y el alcance global del limite: tres decisiones que el plan no contemplaba y que el change deja documentadas como preguntas abiertas. |

### 5. ¿Qué ventajas y limitaciones identificó al utilizar SDD con OpenSpec frente al desarrollo basado únicamente en instrucciones directas a una IA?

**Ventajas (verificadas en este proyecto):**

1. La especificacion actua como **detector de contradicciones** antes de que el codigo las materialice (2 hallazgos criticos evitados).
2. La **revision de requisitos** produce mas valor que la validacion automatica: 11 hallazgos, todos de semantica.
3. La gestion de cambios deja un **rastro legible y auditable** de por que se tom cada decision.
4. La **trazabilidad es demostrable**, no declarativa.
5. La revision de codigo generado es mas rapida porque se dispone del comportamiento esperado.
6. Los **impactos de alcance** (p. ej. "no hace falta cambiar el esquema") se identifican antes de implementar.

**Limitaciones (verificadas):**

1. OpenSpec valida la **forma, no el sentido**: la revision manual sigue siendo obligatoria.
2. Escribir especificaciones **consume tiempo** que no es codigo, y esa inversion debe justificarse.
3. Los requisitos **envejecen** y corregirlos es mas caro que redactarlos bien.
4. El **archivado** y el orden de los deltas exigen entender el ciclo de vida de OpenSpec.
5. La disciplina **no es automatica**: la sostiene la decision de no tocar `src/` sin especificacion que lo autorice.

**Conclusion:** para un dominio cuya dificultad esta en la **integridad de datos** y no en la complejidad algoritmica, la especificacion formal es un multiplicador de la capacidad de la IA, porque convierte "genera un sistema de reservas" (vago, con miles de decisiones implicitas) en "genera exactamente este comportamiento, con estos codigos de error, en estos casos limite" (preciso, verificable y auditable).

---

*Documento generado al cierre de la ETAPA 2 del proyecto. Las cifras citadas (47 requisitos, 116 escenarios, 214 pruebas, 11 hallazgos, 2 changes archivados) son verificables mediante `npm run verify`, `openspec validate --all --strict` y `git log`.*
