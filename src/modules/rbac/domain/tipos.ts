import type { Rol } from '../../../domain/tipos.js';

export interface UsuarioAutenticado {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
  permisos: ReadonlySet<string>;
  tokenVersion: number;
}

export interface RolConPermisos {
  id: number;
  nombre: Rol;
  descripcion: string;
  permisos: string[];
}

export interface Permiso {
  id: number;
  clave: string;
  descripcion: string;
}
