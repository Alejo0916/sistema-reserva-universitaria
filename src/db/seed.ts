import 'dotenv/config';
import { cargarConfig } from '../shared/config.js';
import { abrirConexion, aplicarEsquema } from './conexion.js';
import { RepositorioRoles } from './repositorios/rolRepo.js';
import { RepositorioUsuarios } from './repositorios/usuarioRepo.js';
import { RepositorioEspacios } from './repositorios/espacioRepo.js';
import { hashContrasena } from '../modules/auth/domain/contrasena.js';
import { ESPACIOS_SEMILLA, USUARIOS_SEMILLA } from './semilla/datos.js';

/**
 * Siembra la base de datos con el catalogo de roles y permisos, los usuarios
 * de ejemplo y los espacios academicos de la institucion.
 *
 * Es idempotente: los usuarios y espacios que ya existen no se duplican.
 */
const config = cargarConfig();
const conexion = abrirConexion({ ruta: config.rutaBaseDatos });

try {
  aplicarEsquema(conexion);

  const roles = new RepositorioRoles(conexion);
  roles.sembrarCatalogo();
  console.log('Catalogo de roles y permisos sembrado');

  const usuarios = new RepositorioUsuarios(conexion);
  let creados = 0;
  for (const usuario of USUARIOS_SEMILLA) {
    if (usuarios.existeEmail(usuario.email)) {
      continue;
    }
    const rolId = roles.idDeRol(usuario.rol);
    if (rolId === null) {
      throw new Error(`El rol ${usuario.rol} no existe en el catalogo`);
    }
    const hash = await hashContrasena(usuario.contrasena);
    usuarios.crear({
      nombre: usuario.nombre,
      email: usuario.email,
      passwordHash: hash,
      rolId,
      activo: true,
      ahora: new Date().toISOString(),
    });
    creados += 1;
  }
  console.log(`Usuarios de ejemplo: ${creados} creados`);

  const espacios = new RepositorioEspacios(conexion);
  let espaciosCreados = 0;
  for (const espacio of ESPACIOS_SEMILLA) {
    if (espacios.existeCodigo(espacio.codigo)) {
      continue;
    }
    espacios.crear({
      codigo: espacio.codigo,
      nombre: espacio.nombre,
      tipo: espacio.tipo,
      descripcion: espacio.descripcion,
      capacidad: espacio.capacidad,
      edificio: espacio.edificio,
      piso: espacio.piso,
      horarioApertura: espacio.horarioApertura,
      horarioCierre: espacio.horarioCierre,
      activo: true,
      ahora: new Date().toISOString(),
    });
    espaciosCreados += 1;
  }
  console.log(`Espacios academicos: ${espaciosCreados} creados`);
} finally {
  conexion.close();
}
