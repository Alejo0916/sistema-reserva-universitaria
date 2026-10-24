/**
 * Catalogo de permisos y matriz rol -> permisos.
 *
 * Fuente unica de verdad: la semilla de la base de datos se construye a
 * partir de estas constantes (design.md, decision D5), de modo que el
 * catalogo expuesto por la API y el almacenado nunca divergen.
 */

export const PERMISOS = {
  ESPACIOS_LEER: 'espacios:leer',
  ESPACIOS_ESCRIBIR: 'espacios:escribir',
  RESERVAS_CREAR: 'reservas:crear',
  RESERVAS_LEER: 'reservas:leer',
  RESERVAS_CANCELAR: 'reservas:cancelar',
  RESERVAS_APROBAR: 'reservas:aprobar',
  USUARIOS_LEER: 'usuarios:leer',
  USUARIOS_ESCRIBIR: 'usuarios:escribir',
  ROLES_LEER: 'roles:leer',
  AUDITORIA_LEER: 'auditoria:leer',
} as const;

export type ClavePermiso = (typeof PERMISOS)[keyof typeof PERMISOS];

export interface DefinicionPermiso {
  clave: string;
  descripcion: string;
}

export const CATALOGO_PERMISOS: readonly DefinicionPermiso[] = [
  { clave: PERMISOS.ESPACIOS_LEER, descripcion: 'Consultar el catalogo de espacios y su disponibilidad' },
  { clave: PERMISOS.ESPACIOS_ESCRIBIR, descripcion: 'Crear, editar, activar y desactivar espacios' },
  { clave: PERMISOS.RESERVAS_CREAR, descripcion: 'Crear solicitudes de reserva' },
  { clave: PERMISOS.RESERVAS_LEER, descripcion: 'Consultar reservas visibles para el rol' },
  { clave: PERMISOS.RESERVAS_CANCELAR, descripcion: 'Cancelar reservas propias' },
  { clave: PERMISOS.RESERVAS_APROBAR, descripcion: 'Aprobar o rechazar solicitudes de reserva' },
  { clave: PERMISOS.USUARIOS_LEER, descripcion: 'Consultar el directorio de usuarios' },
  { clave: PERMISOS.USUARIOS_ESCRIBIR, descripcion: 'Crear, editar y desactivar usuarios' },
  { clave: PERMISOS.ROLES_LEER, descripcion: 'Consultar el catalogo de roles y permisos' },
  { clave: PERMISOS.AUDITORIA_LEER, descripcion: 'Consultar la bitacora global de eventos' },
];

export interface DefinicionRol {
  nombre: string;
  descripcion: string;
  permisos: readonly string[];
}

const PERMISOS_ADMIN: readonly string[] = CATALOGO_PERMISOS.map((permiso) => permiso.clave);

export const CATALOGO_ROLES: readonly DefinicionRol[] = [
  {
    nombre: 'ADMIN',
    descripcion: 'Administracion completa del sistema: usuarios, espacios, roles y aprobacion de reservas',
    permisos: PERMISOS_ADMIN,
  },
  {
    nombre: 'COORDINADOR',
    descripcion: 'Gestion academica de espacios y resolucion de solicitudes de reserva',
    permisos: [
      PERMISOS.ESPACIOS_LEER,
      PERMISOS.ESPACIOS_ESCRIBIR,
      PERMISOS.RESERVAS_CREAR,
      PERMISOS.RESERVAS_LEER,
      PERMISOS.RESERVAS_CANCELAR,
      PERMISOS.RESERVAS_APROBAR,
      PERMISOS.USUARIOS_LEER,
      PERMISOS.ROLES_LEER,
      PERMISOS.AUDITORIA_LEER,
    ],
  },
  {
    nombre: 'DOCENTE',
    descripcion: 'Solicitud y gestion de reservas propias',
    permisos: [
      PERMISOS.ESPACIOS_LEER,
      PERMISOS.RESERVAS_CREAR,
      PERMISOS.RESERVAS_LEER,
      PERMISOS.RESERVAS_CANCELAR,
    ],
  },
  {
    nombre: 'ESTUDIANTE',
    descripcion: 'Solicitud y gestion de reservas propias',
    permisos: [
      PERMISOS.ESPACIOS_LEER,
      PERMISOS.RESERVAS_CREAR,
      PERMISOS.RESERVAS_LEER,
      PERMISOS.RESERVAS_CANCELAR,
    ],
  },
];

export function esPermisoConocido(clave: string): boolean {
  return CATALOGO_PERMISOS.some((permiso) => permiso.clave === clave);
}
