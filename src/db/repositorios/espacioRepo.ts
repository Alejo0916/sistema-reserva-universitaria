import type { Conexion } from '../conexion.js';
import type { TipoEspacio } from '../../domain/tipos.js';
import type { Espacio } from '../../modules/space-management/domain/espacio.js';

interface FilaEspacio {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoEspacio;
  descripcion: string | null;
  capacidad: number;
  edificio: string | null;
  piso: string | null;
  horario_apertura: string;
  horario_cierre: string;
  activo: number;
  creado_en: string;
  actualizado_en: string;
}

function aEspacio(fila: FilaEspacio): Espacio {
  return {
    id: fila.id,
    codigo: fila.codigo,
    nombre: fila.nombre,
    tipo: fila.tipo,
    descripcion: fila.descripcion,
    capacidad: fila.capacidad,
    edificio: fila.edificio,
    piso: fila.piso,
    horarioApertura: fila.horario_apertura,
    horarioCierre: fila.horario_cierre,
    activo: fila.activo === 1,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
  };
}

const SELECT_ESPACIO = 'SELECT * FROM espacios';

export interface NuevoEspacio {
  codigo: string;
  nombre: string;
  tipo: TipoEspacio;
  descripcion: string | null;
  capacidad: number;
  edificio: string | null;
  piso: string | null;
  horarioApertura: string;
  horarioCierre: string;
  activo: boolean;
  ahora: string;
}

export interface ActualizacionEspacio {
  codigo?: string | undefined;
  nombre?: string | undefined;
  tipo?: TipoEspacio | undefined;
  descripcion?: string | null | undefined;
  capacidad?: number | undefined;
  edificio?: string | null | undefined;
  piso?: string | null | undefined;
  horarioApertura?: string | undefined;
  horarioCierre?: string | undefined;
  activo?: boolean | undefined;
}

export interface CriteriosEspacio {
  tipo?: TipoEspacio | undefined;
  activo?: boolean | undefined;
}

export class RepositorioEspacios {
  constructor(private readonly conexion: Conexion) {}

  buscarPorId(id: number): Espacio | null {
    const fila = this.conexion.prepare(`${SELECT_ESPACIO} WHERE id = ?`).get(id) as FilaEspacio | undefined;
    return fila === undefined ? null : aEspacio(fila);
  }

  buscarPorCodigo(codigo: string): Espacio | null {
    const fila = this.conexion.prepare(`${SELECT_ESPACIO} WHERE codigo = ?`).get(codigo) as FilaEspacio | undefined;
    return fila === undefined ? null : aEspacio(fila);
  }

  /** Busca por identificador numerico o por codigo alfanumerico. */
  buscarPorReferencia(referencia: string): Espacio | null {
    if (/^\d+$/.test(referencia)) {
      const porId = this.buscarPorId(Number(referencia));
      if (porId !== null) {
        return porId;
      }
    }
    return this.buscarPorCodigo(referencia);
  }

  existeCodigo(codigo: string, exceptoId?: number): boolean {
    const fila =
      exceptoId === undefined
        ? this.conexion.prepare('SELECT 1 FROM espacios WHERE codigo = ?').get(codigo)
        : this.conexion.prepare('SELECT 1 FROM espacios WHERE codigo = ? AND id <> ?').get(codigo, exceptoId);
    return fila !== undefined;
  }

  crear(datos: NuevoEspacio): Espacio {
    const resultado = this.conexion
      .prepare(
        `INSERT INTO espacios (codigo, nombre, tipo, descripcion, capacidad, edificio, piso,
                               horario_apertura, horario_cierre, activo, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        datos.codigo,
        datos.nombre,
        datos.tipo,
        datos.descripcion,
        datos.capacidad,
        datos.edificio,
        datos.piso,
        datos.horarioApertura,
        datos.horarioCierre,
        datos.activo ? 1 : 0,
        datos.ahora,
        datos.ahora,
      );

    const espacio = this.buscarPorId(Number(resultado.lastInsertRowid));
    if (espacio === null) {
      throw new Error('No se pudo leer el espacio recien creado');
    }
    return espacio;
  }

  actualizar(id: number, cambios: ActualizacionEspacio, ahora: string): Espacio | null {
    const actual = this.buscarPorId(id);
    if (actual === null) {
      return null;
    }

    this.conexion
      .prepare(
        `UPDATE espacios
         SET codigo = ?, nombre = ?, tipo = ?, descripcion = ?, capacidad = ?, edificio = ?, piso = ?,
             horario_apertura = ?, horario_cierre = ?, activo = ?, actualizado_en = ?
         WHERE id = ?`,
      )
      .run(
        cambios.codigo ?? actual.codigo,
        cambios.nombre ?? actual.nombre,
        cambios.tipo ?? actual.tipo,
        cambios.descripcion === undefined ? actual.descripcion : cambios.descripcion,
        cambios.capacidad ?? actual.capacidad,
        cambios.edificio === undefined ? actual.edificio : cambios.edificio,
        cambios.piso === undefined ? actual.piso : cambios.piso,
        cambios.horarioApertura ?? actual.horarioApertura,
        cambios.horarioCierre ?? actual.horarioCierre,
        (cambios.activo ?? actual.activo) ? 1 : 0,
        ahora,
        id,
      );

    return this.buscarPorId(id);
  }

  /** Cuenta las reservas que ocupan la franja (pendientes o aprobadas). */
  contarReservasActivas(espacioId: number): number {
    const fila = this.conexion
      .prepare(
        `SELECT COUNT(*) AS n FROM reservas
         WHERE espacio_id = ? AND estado IN ('PENDIENTE', 'APROBADA')`,
      )
      .get(espacioId) as { n: number };
    return fila.n;
  }

  listar(criterios: CriteriosEspacio, pagina: number, limite: number): { datos: Espacio[]; total: number } {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];

    if (criterios.tipo !== undefined) {
      condiciones.push('tipo = ?');
      parametros.push(criterios.tipo);
    }
    if (criterios.activo !== undefined) {
      condiciones.push('activo = ?');
      parametros.push(criterios.activo ? 1 : 0);
    }

    const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const total = (this.conexion.prepare(`SELECT COUNT(*) AS n FROM espacios ${donde}`).get(...parametros) as { n: number }).n;

    const filas = this.conexion
      .prepare(`${SELECT_ESPACIO} ${donde} ORDER BY codigo LIMIT ? OFFSET ?`)
      .all(...parametros, limite, (pagina - 1) * limite) as FilaEspacio[];

    return { datos: filas.map(aEspacio), total };
  }
}
