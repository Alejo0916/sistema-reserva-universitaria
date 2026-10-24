import 'dotenv/config';
import { existsSync, rmSync } from 'node:fs';
import { cargarConfig } from '../shared/config.js';

const config = cargarConfig();

if (config.rutaBaseDatos === ':memory:') {
  console.error('No se puede resetear una base de datos en memoria');
  process.exit(1);
}

if (existsSync(config.rutaBaseDatos)) {
  rmSync(config.rutaBaseDatos, { force: true });
}
for (const sufijo of ['-wal', '-shm']) {
  const ruta = `${config.rutaBaseDatos}${sufijo}`;
  if (existsSync(ruta)) {
    rmSync(ruta, { force: true });
  }
}

console.log(`Base de datos eliminada: ${config.rutaBaseDatos}`);
console.log('Ejecute "npm run db:migrate" y "npm run db:seed" para recrearla.');
