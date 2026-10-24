import type { Conexion } from './conexion.js';

/**
 * Ejecuta una funcion dentro de una transaccion `BEGIN IMMEDIATE`.
 *
 * `IMMEDIATE` toma el bloqueo de escritura de la base de datos al abrir la
 * transaccion, de modo que ninguna otra escritura puede intercalarse entre
 * la verificacion de disponibilidad y la insercion de la reserva. Es la
 * garantia de exclusion mutua del sistema (design.md, decision D3).
 */
export function enTransaccion<T>(conexion: Conexion, operacion: () => T): T {
  return conexion.transaction(operacion).immediate();
}
