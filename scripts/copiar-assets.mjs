import { copyFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Copia a `dist/` los recursos que no son TypeScript y que el compilador
 * no arrastra: en concreto, el esquema SQL de la base de datos.
 *
 * Sin este paso, `npm start` falla al arrancar porque no encuentra
 * `dist/db/schema.sql` (el esquema se lee en tiempo de ejecucion).
 */
const raizProyecto = join(dirname(fileURLToPath(import.meta.url)), '..');

const recursos = [['src/db/schema.sql', 'dist/db/schema.sql']];

for (const [origen, destino] of recursos) {
  const rutaDestino = join(raizProyecto, destino);
  mkdirSync(dirname(rutaDestino), { recursive: true });
  copyFileSync(join(raizProyecto, origen), rutaDestino);
  console.log(`Copiado ${origen} -> ${destino}`);
}
