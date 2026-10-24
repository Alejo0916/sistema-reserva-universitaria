import 'dotenv/config';
import { cargarConfig } from '../shared/config.js';
import { abrirConexion, aplicarEsquema } from './conexion.js';

/**
 * Aplica el esquema de la base de datos. Es idempotente: puede ejecutarse
 * varias veces sin duplicar objetos ni perder datos.
 */
const config = cargarConfig();
const conexion = abrirConexion({ ruta: config.rutaBaseDatos });

try {
  aplicarEsquema(conexion);
  console.log(`Esquema aplicado correctamente en ${config.rutaBaseDatos}`);
} finally {
  conexion.close();
}
