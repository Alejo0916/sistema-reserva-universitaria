import 'dotenv/config';
import { cargarConfig } from './shared/config.js';
import { abrirConexion, aplicarEsquema } from './db/conexion.js';
import { crearContenedor } from './container.js';
import { crearAplicacion } from './app.js';

const config = cargarConfig();
const conexion = abrirConexion({ ruta: config.rutaBaseDatos });

aplicarEsquema(conexion);

const contenedor = crearContenedor({ config, conexion });
const aplicacion = crearAplicacion(contenedor);

const servidor = aplicacion.listen(config.puerto, config.host, () => {
  console.log(`SIGREA escuchando en http://localhost:${config.puerto}`);
  console.log(`Base de datos: ${config.rutaBaseDatos}`);
});

function cerrar(senal: string): void {
  console.log(`\nSIGREA detenido (${senal})`);
  servidor.close(() => {
    conexion.close();
    process.exit(0);
  });
}

process.on('SIGINT', () => {
  cerrar('SIGINT');
});

process.on('SIGTERM', () => {
  cerrar('SIGTERM');
});
