import type { Rol } from '../../../domain/tipos.js';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rolId: number;
  rol: Rol;
  activo: boolean;
  tokenVersion: number;
  creadoEn: string;
  actualizadoEn: string;
}

export interface UsuarioConHash extends Usuario {
  passwordHash: string;
}

export interface CriteriosUsuario {
  rol?: Rol | undefined;
  activo?: boolean | undefined;
  texto?: string | undefined;
}

/** Vista publica del usuario: nunca incluye la contrasena ni su hash. */
export function aUsuarioPublico(usuario: Usuario): Omit<Usuario, 'passwordHash'> {
  return {
    id: usuario.id,
    nombre: usuario.nombre,
    email: usuario.email,
    rolId: usuario.rolId,
    rol: usuario.rol,
    activo: usuario.activo,
    tokenVersion: usuario.tokenVersion,
    creadoEn: usuario.creadoEn,
    actualizadoEn: usuario.actualizadoEn,
  };
}
