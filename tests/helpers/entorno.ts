import type { Express } from 'express';
import bcrypt from 'bcryptjs';
import { abrirConexion, aplicarEsquema } from '../../src/db/conexion.js';
import type { Conexion } from '../../src/db/conexion.js';
import type { RepositorioRoles } from '../../src/db/repositorios/rolRepo.js';
import type { RepositorioUsuarios } from '../../src/db/repositorios/usuarioRepo.js';
import type { RepositorioEspacios } from '../../src/db/repositorios/espacioRepo.js';
import { hashContrasena } from '../../src/modules/auth/domain/contrasena.js';
import { crearContenedor } from '../../src/container.js';
import type { Contenedor } from '../../src/container.js';
import { crearAplicacion } from '../../src/app.js';
import { cargarConfig } from '../../src/shared/config.js';
import type { Config } from '../../src/shared/config.js';
import { crearRelojFijo } from '../../src/shared/reloj.js';
import type { Reloj } from '../../src/shared/reloj.js';

export const FECHA_REFERENCIA = '2026-03-16';

/**
 * Instante de referencia del reloj de negocio.
 *
 * Se construye con el constructor local de `Date` a proposito: el reloj del
 * dominio trabaja en hora civil local (ver design.md, decision D8), de modo
 * que la referencia debe estar anclada a la misma hora civil y no a un
 * instante UTC. De lo contrario las pruebas serian dependientes de la zona
 * horaria de la maquina que las ejecuta (riesgo R-09 del plan).
 */
export const INSTANTE_REFERENCIA = new Date(2026, 2, 16, 8, 0, 0, 0);

export const CONTRASENA = 'clave1234';
export const CONTRASENA_ADMIN = 'admin1234';
export const CONTRASENA_COORDINADOR = 'coord1234';
export const CONTRASENA_DOCENTE = 'docen1234';

/** Hashes precalculados: permiten sembrar usuarios de forma sincrona. */
const HASH_ADMIN = bcrypt.hashSync(CONTRASENA_ADMIN, 10);
const HASH_COORDINADOR = bcrypt.hashSync(CONTRASENA_COORDINADOR, 10);
const HASH_DOCENTE = bcrypt.hashSync(CONTRASENA_DOCENTE, 10);

export interface EntornoPrueba {
  app: Express;
  contenedor: Contenedor;
  conexion: Conexion;
  reloj: Reloj;
  config: Config;
  usuarios: RepositorioUsuarios;
  roles: RepositorioRoles;
  espacios: RepositorioEspacios;
  cerrar(): void;
}

export function crearEntornoPrueba(opciones: { reloj?: Reloj } = {}): EntornoPrueba {
  const config: Config = {
    ...cargarConfig({
      JWT_SECRET: 'secreto-de-pruebas-suficientemente-largo-1234',
      DATABASE_URL: ':memory:',
      ANTICIPACION_MINIMA_HORAS: '2',
      DURACION_MINIMA_MINUTOS: '15',
      ESPACIO_HORARIO_APERTURA: '08:00',
      ESPACIO_HORARIO_CIERRE: '22:00',
    }),
    esProduccion: false,
  };

  const conexion = abrirConexion({ ruta: ':memory:' });
  aplicarEsquema(conexion);

  const reloj = opciones.reloj ?? crearRelojFijo(INSTANTE_REFERENCIA);
  const contenedor = crearContenedor({ config, conexion, reloj });

  contenedor.repositorios.roles.sembrarCatalogo();

  const usuarios = contenedor.repositorios.usuarios;
  const espacios = contenedor.repositorios.espacios;

  // Usuarios base de la institucion, creados de forma sincrona con hashes
  // precalculados para que las pruebas puedan iniciar sesion sin esperas.
  const adminId = contenedor.repositorios.roles.idDeRol('ADMIN');
  const coordinadorId = contenedor.repositorios.roles.idDeRol('COORDINADOR');
  const docenteId = contenedor.repositorios.roles.idDeRol('DOCENTE');
  if (adminId === null || coordinadorId === null || docenteId === null) {
    throw new Error('El catalogo de roles no esta sembrado');
  }

  const ahora = new Date().toISOString();
  usuarios.crear({
    nombre: 'Administrador del Sistema',
    email: 'admin@uni.edu',
    passwordHash: HASH_ADMIN,
    rolId: adminId,
    activo: true,
    ahora,
  });
  usuarios.crear({
    nombre: 'Coordinadora Academica',
    email: 'coordinador@uni.edu',
    passwordHash: HASH_COORDINADOR,
    rolId: coordinadorId,
    activo: true,
    ahora,
  });
  usuarios.crear({
    nombre: 'Docente de Prueba',
    email: 'docente@uni.edu',
    passwordHash: HASH_DOCENTE,
    rolId: docenteId,
    activo: true,
    ahora,
  });

  return {
    app: crearAplicacion(contenedor),
    contenedor,
    conexion,
    reloj,
    config,
    usuarios,
    roles: contenedor.repositorios.roles,
    espacios,
    cerrar: () => {
      conexion.close();
    },
  };
}

export async function crearUsuario(
  entorno: EntornoPrueba,
  datos: { nombre: string; email: string; rol: string; contrasena?: string },
): Promise<number> {
  const rolId = entorno.roles.idDeRol(datos.rol);
  if (rolId === null) {
    throw new Error(`El rol ${datos.rol} no existe`);
  }
  const hash = await hashContrasena(datos.contrasena ?? CONTRASENA);
  const usuario = entorno.usuarios.crear({
    nombre: datos.nombre,
    email: datos.email,
    passwordHash: hash,
    rolId,
    activo: true,
    ahora: new Date().toISOString(),
  });
  return usuario.id;
}

export function crearEspacio(
  entorno: EntornoPrueba,
  datos: Partial<{
    codigo: string;
    nombre: string;
    tipo: 'LABORATORIO' | 'AUDITORIO' | 'SALA_COMPUTO' | 'SALA_REUNION' | 'SEMINARIO';
    descripcion: string;
    capacidad: number;
    edificio: string;
    piso: string;
    horarioApertura: string;
    horarioCierre: string;
    activo: boolean;
  }> = {},
): number {
  const espacio = entorno.espacios.crear({
    codigo: datos.codigo ?? 'LAB-101',
    nombre: datos.nombre ?? 'Laboratorio de Prueba',
    tipo: datos.tipo ?? 'LABORATORIO',
    descripcion: datos.descripcion ?? 'Espacio de pruebas',
    capacidad: datos.capacidad ?? 24,
    edificio: datos.edificio ?? 'Edificio A',
    piso: datos.piso ?? '1',
    horarioApertura: datos.horarioApertura ?? '08:00',
    horarioCierre: datos.horarioCierre ?? '22:00',
    activo: datos.activo ?? true,
    ahora: new Date().toISOString(),
  });
  return espacio.id;
}
