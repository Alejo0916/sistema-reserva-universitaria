import type { Conexion } from '../conexion.js';
import type { Rol } from '../../domain/tipos.js';
import type { Usuario, UsuarioConHash } from '../../modules/user-management/domain/usuario.js';
import type { CriteriosUsuario } from '../../modules/user-management/domain/usuario.js';

interface FilaUsuario {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol_id: number;
  rol_nombre: Rol;
  activo: number;
  token_version: number;
  creado_en: string;
  actualizado_en: string;
}

const SELECT_USUARIO = `
  SELECT u.id, u.nombre, u.email, u.password_hash, u.rol_id, r.nombre AS rol_nombre,
         u.activo, u.token_version, u.creado_en, u.actualizado_en
  FROM usuarios u
  JOIN roles r ON r.id = u.rol_id
`;

function aUsuario(fila: FilaUsuario): UsuarioConHash {
  return {
    id: fila.id,
    nombre: fila.nombre,
    email: fila.email,
    passwordHash: fila.password_hash,
    rolId: fila.rol_id,
    rol: fila.rol_nombre,
    activo: fila.activo === 1,
    tokenVersion: fila.token_version,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

export interface NuevoUsuario {
  nombre: string;
  email: string;
  passwordHash: string;
  rolId: number;
  activo: boolean;
  ahora: string;
}

export class RepositorioUsuarios {
  constructor(private readonly conexion: Conexion) {}

  buscarPorId(id: number): UsuarioConHash | null {
    const fila = this.conexion.prepare(`${SELECT_USUARIO} WHERE u.id = ?`).get(id) as FilaUsuario | undefined;
    return fila === undefined ? null : aUsuario(fila);
  }

  buscarPorCorreo(email: string): UsuarioConHash | null {
    const fila = this.conexion.prepare(`${SELECT_USUARIO} WHERE u.email = ?`).get(email) as FilaUsuario | undefined;
    return fila === undefined ? null : aUsuario(fila);
  }

  existeEmail(email: string, exceptoId?: number): boolean {
    const fila =
      exceptoId === undefined
        ? this.conexion.prepare('SELECT 1 FROM usuarios WHERE email = ?').get(email)
        : this.conexion.prepare('SELECT 1 FROM usuarios WHERE email = ? AND id <> ?').get(email, exceptoId);
    return fila !== undefined;
  }

  crear(datos: NuevoUsuario): UsuarioConHash {
    const resultado = this.conexion
      .prepare(
        `INSERT INTO usuarios (nombre, email, password_hash, rol_id, activo, token_version, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, 1, ?, ?)`,
      )
      .run(datos.nombre, datos.email, datos.passwordHash, datos.rolId, datos.activo ? 1 : 0, datos.ahora, datos.ahora);

    const usuario = this.buscarPorId(Number(resultado.lastInsertRowid));
    if (usuario === null) {
      throw new Error('No se pudo leer el usuario recien creado');
    }
    return usuario;
  }

  actualizar(
    id: number,
    cambios: {
      nombre?: string | undefined;
      email?: string | undefined;
      rolId?: number | undefined;
      activo?: boolean | undefined;
    },
    ahora: string,
  ): UsuarioConHash | null {
    const usuario = this.buscarPorId(id);
    if (usuario === null) {
      return null;
    }

    this.conexion
      .prepare(
        `UPDATE usuarios
         SET nombre = ?, email = ?, rol_id = ?, activo = ?, actualizado_en = ?
         WHERE id = ?`,
      )
      .run(
        cambios.nombre ?? usuario.nombre,
        cambios.email ?? usuario.email,
        cambios.rolId ?? usuario.rolId,
        (cambios.activo ?? usuario.activo) ? 1 : 0,
        ahora,
        id,
      );

    return this.buscarPorId(id);
  }

  /** Incrementa la version del token: invalida todos los tokens emitidos. */
  incrementarVersionToken(id: number, ahora: string): void {
    this.conexion
      .prepare('UPDATE usuarios SET token_version = token_version + 1, actualizado_en = ? WHERE id = ?')
      .run(ahora, id);
  }

  cambiarPassword(id: number, passwordHash: string, ahora: string): void {
    this.conexion
      .prepare(
        `UPDATE usuarios
         SET password_hash = ?, token_version = token_version + 1, actualizado_en = ?
         WHERE id = ?`,
      )
      .run(passwordHash, ahora, id);
  }

  listar(criterios: CriteriosUsuario, pagina: number, limite: number): { datos: Usuario[]; total: number } {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];

    if (criterios.rol !== undefined) {
      condiciones.push('r.nombre = ?');
      parametros.push(criterios.rol);
    }
    if (criterios.activo !== undefined) {
      condiciones.push('u.activo = ?');
      parametros.push(criterios.activo ? 1 : 0);
    }
    if (criterios.texto !== undefined && criterios.texto !== '') {
      condiciones.push('(u.nombre LIKE ? COLLATE NOCASE OR u.email LIKE ? COLLATE NOCASE)');
      const patron = `%${criterios.texto}%`;
      parametros.push(patron, patron);
    }

    const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const total = (
      this.conexion.prepare(`SELECT COUNT(*) AS n FROM usuarios u JOIN roles r ON r.id = u.rol_id ${donde}`).get(...parametros) as {
        n: number;
      }
    ).n;

    const filas = this.conexion
      .prepare(`${SELECT_USUARIO} ${donde} ORDER BY u.nombre COLLATE NOCASE LIMIT ? OFFSET ?`)
      .all(...parametros, limite, (pagina - 1) * limite) as FilaUsuario[];

    return { datos: filas.map(aUsuario), total };
  }
}
