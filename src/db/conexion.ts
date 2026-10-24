import Database from 'better-sqlite3';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directorioActual = dirname(fileURLToPath(import.meta.url));

export type Conexion = Database.Database;

export interface OpcionesConexion {
  ruta: string;
  verbose?: (mensaje?: unknown, ...args: unknown[]) => void;
}

/**
 * Abre la base de datos y aplica los pragmas de integridad y rendimiento.
 *
 * - `foreign_keys = ON`: SQLite lo tiene desactivado por defecto; sin el, las
 *   restricciones referenciales del esquema no se aplican.
 * - `journal_mode = WAL` y `synchronous = FULL`: durability para el caso de
 *   caida del proceso a mitad de escritura (riesgo R-07 del plan).
 */
export function abrirConexion(opciones: OpcionesConexion): Conexion {
  const esMemoria = opciones.ruta === ':memory:';
  if (!esMemoria) {
    const carpeta = dirname(opciones.ruta);
    if (carpeta !== '.' && !carpeta.startsWith(':')) {
      mkdirSync(carpeta, { recursive: true });
    }
  }

  const conexion = new Database(opciones.ruta, opciones.verbose === undefined ? undefined : { verbose: opciones.verbose });

  conexion.pragma('foreign_keys = ON');
  if (!esMemoria) {
    conexion.pragma('journal_mode = WAL');
  }
  conexion.pragma('synchronous = FULL');
  conexion.pragma('busy_timeout = 5000');

  return conexion;
}

/** Aplica el esquema base. Es idempotente: puede ejecutarse varias veces. */
export function aplicarEsquema(conexion: Conexion): void {
  const esquema = readFileSync(join(directorioActual, 'schema.sql'), 'utf-8');
  conexion.exec(esquema);
}

/**
 * Comprueba la integridad logica de la base de datos.
 * Se expone en `GET /api/health` para detectar corrupcion (riesgo R-07).
 */
export function verificarIntegridad(conexion: Conexion): boolean {
  const resultado = conexion.pragma('integrity_check', { simple: true });
  return resultado === 'ok';
}
