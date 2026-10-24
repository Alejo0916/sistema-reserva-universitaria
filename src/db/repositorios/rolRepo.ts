import type { Conexion } from '../conexion.js';
import type { Rol } from '../../domain/tipos.js';
import type { Permiso, RolConPermisos } from '../../modules/rbac/domain/tipos.js';
import { CATALOGO_PERMISOS, CATALOGO_ROLES } from '../../modules/rbac/domain/catalogo.js';

interface FilaRol {
  id: number;
  nombre: Rol;
  descripcion: string;
}

interface FilaPermiso {
  id: number;
  clave: string;
  descripcion: string;
}

export class RepositorioRoles {
  constructor(private readonly conexion: Conexion) {}

  /** Siembra el catalogo de roles, permisos y su matriz. Es idempotente. */
  sembrarCatalogo(): void {
    const inserirRol = this.conexion.prepare(
      'INSERT INTO roles (nombre, descripcion) VALUES (?, ?) ON CONFLICT(nombre) DO UPDATE SET descripcion = excluded.descripcion',
    );
    const inserirPermiso = this.conexion.prepare(
      'INSERT INTO permisos (clave, descripcion) VALUES (?, ?) ON CONFLICT(clave) DO UPDATE SET descripcion = excluded.descripcion',
    );

    for (const rol of CATALOGO_ROLES) {
      inserirRol.run(rol.nombre, rol.descripcion);
    }
    for (const permiso of CATALOGO_PERMISOS) {
      inserirPermiso.run(permiso.clave, permiso.descripcion);
    }

    const idRol = this.conexion.prepare('SELECT id FROM roles WHERE nombre = ?');
    const idPermiso = this.conexion.prepare('SELECT id FROM permisos WHERE clave = ?');
    const vincular = this.conexion.prepare(
      'INSERT INTO rol_permisos (rol_id, permiso_id) VALUES (?, ?) ON CONFLICT(rol_id, permiso_id) DO NOTHING',
    );
    const quitar = this.conexion.prepare('DELETE FROM rol_permisos WHERE rol_id = ?');

    for (const rol of CATALOGO_ROLES) {
      const filaRol = idRol.get(rol.nombre) as { id: number } | undefined;
      if (filaRol === undefined) {
        continue;
      }
      quitar.run(filaRol.id);
      for (const clave of rol.permisos) {
        const filaPermiso = idPermiso.get(clave) as { id: number } | undefined;
        if (filaPermiso !== undefined) {
          vincular.run(filaRol.id, filaPermiso.id);
        }
      }
    }
  }

  idDeRol(nombre: string): number | null {
    const fila = this.conexion.prepare('SELECT id FROM roles WHERE nombre = ?').get(nombre) as { id: number } | undefined;
    return fila === undefined ? null : fila.id;
  }

  existeRol(nombre: string): boolean {
    return this.idDeRol(nombre) !== null;
  }

  listarRoles(): RolConPermisos[] {
    const filas = this.conexion
      .prepare(
        `SELECT r.id, r.nombre, r.descripcion
         FROM roles r
         ORDER BY CASE r.nombre
           WHEN 'ADMIN' THEN 1 WHEN 'COORDINADOR' THEN 2 WHEN 'DOCENTE' THEN 3 ELSE 4 END`,
      )
      .all() as FilaRol[];

    return filas.map((fila) => ({
      id: fila.id,
      nombre: fila.nombre,
      descripcion: fila.descripcion,
      permisos: this.permisosDeRol(fila.id),
    }));
  }

  permisosDeRol(rolId: number): string[] {
    const filas = this.conexion
      .prepare(
        `SELECT p.clave
         FROM rol_permisos rp
         JOIN permisos p ON p.id = rp.permiso_id
         WHERE rp.rol_id = ?
         ORDER BY p.clave`,
      )
      .all(rolId) as { clave: string }[];
    return filas.map((fila) => fila.clave);
  }

  permisosDeRolPorNombre(nombreRol: string): string[] {
    const id = this.idDeRol(nombreRol);
    return id === null ? [] : this.permisosDeRol(id);
  }

  listarPermisos(): Permiso[] {
    const filas = this.conexion
      .prepare('SELECT id, clave, descripcion FROM permisos ORDER BY clave')
      .all() as FilaPermiso[];
    return filas.map((fila) => ({ id: fila.id, clave: fila.clave, descripcion: fila.descripcion }));
  }
}
