import 'dotenv/config';
import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { cargarConfig } from '../shared/config.js';

const config = cargarConfig();

if (config.rutaBaseDatos === ':memory:' || !existsSync(config.rutaBaseDatos)) {
  console.error(`No existe la base de datos ${config.rutaBaseDatos}`);
  process.exit(1);
}

const carpeta = join(process.cwd(), 'backups');
mkdirSync(carpeta, { recursive: true });

const sello = new Date().toISOString().replace(/[:.]/g, '-');
const destino = join(carpeta, `sigrea-${sello}.db`);

copyFileSync(config.rutaBaseDatos, destino);
console.log(`Copia de respaldo creada: ${destino}`);
