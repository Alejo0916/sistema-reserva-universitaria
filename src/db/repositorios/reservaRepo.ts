import type { Conexion } from '../conexion.js';
import type { EstadoReserva } from '../../domain/tipos.js';
import { ESTADOS_ACTIVOS } from '../../domain/tipos.js';
import type { CriteriosReserva, ReservaDetallada } from '../../modules/reservation-management/domain/reserva.js';

interface FilaReserva {
  id: number;
  espacio_id: number;
  usuario_id: number;
  fecha: string;
  hora_inicio: string;
  hora_fin: string;
  estado: EstadoReserva;
  justificacion: string;
  asistentes: number | null;
  motivo: string | null;
  revisor_id: number | null;
  creado_en: string;
  actualizado_en: string;
  espacio_codigo: string;
  espacio_nombre: string;
  solicitante_nombre: string;
  solicitante_email: string;
  revisor_nombre: string | null;
}

const SELECT_RESERVA = `
  SELECT r.*, e.codigo AS espacio_codigo, e.nombre AS espacio_nombre,
         u.nombre AS solicitante_nombre, u.email AS solicitante_email,
         rev.nombre AS revisor_nombre
  FROM reservas r
  JOIN espacios e ON e.id = r.espacio_id
  JOIN usuarios u ON u.id = r.usuario_id
  LEFT JOIN usuarios rev ON rev.id = r.revisor_id
`;

function aReserva(fila: FilaReserva): ReservaDetallada {
  return {
    id: fila.id,
    espacioId: fila.espacio_id,
    usuarioId: fila.usuario_id,
    fecha: fila.fecha,
    horaInicio: fila.hora_inicio,
    horaFin: fila.hora_fin,
    estado: fila.estado,
    justificacion: fila.justificacion,
    asistentes: fila.asistentes,
    motivo: fila.motivo,
    revisorId: fila.revisor_id,
    creadoEn: fila.creado_en,
    actualizadoEn: fila.actualizado_en,
    espacioCodigo: fila.espacio_codigo,
    espacioNombre: fila.espacio_nombre,
    solicitanteNombre: fila.solicitante_nombre,
    solicitanteEmail: fila.solicitante_email,
    revisorNombre: fila.revisor_nombre,
  };
}

export interface NuevaReserva {
  espacioId: number;
  usuarioId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  justificacion: string;
  asistentes: number | null;
  ahora: string;
}

export class RepositorioReservas {
  constructor(private readonly conexion: Conexion) {}

  buscarPorId(id: number): ReservaDetallada | null {
    const fila = this.conexion.prepare(`${SELECT_RESERVA} WHERE r.id = ?`).get(id) as FilaReserva | undefined;
    return fila === undefined ? null : aReserva(fila);
  }

  /**
   * Busca las reservas que se solapan con la franja indicada y estan activas.
   *
   * Los intervalos son semiabiertos [inicio, fin): `a.hora_inicio < b.hora_fin
   * AND a.hora_fin > b.hora_inicio`. Por eso dos franjas que solo se tocan en
   * un extremo NO se solapan.
   */
  buscarSolapadas(espacioId: number, fecha: string, horaInicio: string, horaFin: string, excluirId?: number): ReservaDetallada[] {
    const condiciones = [
      'r.espacio_id = ?',
      'r.fecha = ?',
      `r.estado IN (${ESTADOS_ACTIVOS.map(() => '?').join(', ')})`,
      'r.hora_inicio < ?',
      'r.hora_fin > ?',
    ];
    const parametros: unknown[] = [espacioId, fecha, ...ESTADOS_ACTIVOS, horaFin, horaInicio];

    if (excluirId !== undefined) {
      condiciones.push('r.id <> ?');
      parametros.push(excluirId);
    }

    const filas = this.conexion
      .prepare(`${SELECT_RESERVA} WHERE ${condiciones.join(' AND ')} ORDER BY r.hora_inicio`)
      .all(...parametros) as FilaReserva[];

    return filas.map(aReserva);
  }

  /**
   * Reservas de un usuario en una fecha, con estado en el que la franja
   * sigue ocupada. El computo no filtra por espacio porque la regla de
   * horas consecutivas se aplica a la union de todas las reservas de la
   * persona en esa fecha (design.md del change `limit-4-horas-consecutivas`,
   * decision D4). Usa el indice `idx_reservas_usuario_fecha`.
   */
  listarActivasDeUsuarioEnFecha(usuarioId: number, fecha: string): ReservaDetallada[] {
    const filas = this.conexion
      .prepare(
        `${SELECT_RESERVA}
         WHERE r.usuario_id = ? AND r.fecha = ?
           AND r.estado IN ('PENDIENTE', 'APROBADA')
         ORDER BY r.hora_inicio`,
      )
      .all(usuarioId, fecha) as FilaReserva[];

    return filas.map(aReserva);
  }

  crear(datos: NuevaReserva): ReservaDetallada {
    const resultado = this.conexion
      .prepare(
        `INSERT INTO reservas (espacio_id, usuario_id, fecha, hora_inicio, hora_fin, estado,
                               justificacion, asistentes, motivo, revisor_id, creado_en, actualizado_en)
         VALUES (?, ?, ?, ?, ?, 'PENDIENTE', ?, ?, NULL, NULL, ?, ?)`,
      )
      .run(
        datos.espacioId,
        datos.usuarioId,
        datos.fecha,
        datos.horaInicio,
        datos.horaFin,
        datos.justificacion,
        datos.asistentes,
        datos.ahora,
        datos.ahora,
      );

    const reserva = this.buscarPorId(Number(resultado.lastInsertRowid));
    if (reserva === null) {
      throw new Error('No se pudo leer la reserva recien creada');
    }
    return reserva;
  }

  actualizarEstado(
    id: number,
    estado: EstadoReserva,
    cambios: { motivo?: string | null; revisorId?: number | null },
    ahora: string,
  ): ReservaDetallada | null {
    const actual = this.buscarPorId(id);
    if (actual === null) {
      return null;
    }

    this.conexion
      .prepare(
        `UPDATE reservas
         SET estado = ?, motivo = ?, revisor_id = ?, actualizado_en = ?
         WHERE id = ?`,
      )
      .run(
        estado,
        cambios.motivo === undefined ? actual.motivo : cambios.motivo,
        cambios.revisorId === undefined ? actual.revisorId : cambios.revisorId,
        ahora,
        id,
      );

    return this.buscarPorId(id);
  }

  listar(
    criterios: CriteriosReserva,
    pagina: number,
    limite: number,
  ): { datos: ReservaDetallada[]; total: number } {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];

    if (criterios.espacioId !== undefined) {
      condiciones.push('r.espacio_id = ?');
      parametros.push(criterios.espacioId);
    }
    if (criterios.usuarioId !== undefined) {
      condiciones.push('r.usuario_id = ?');
      parametros.push(criterios.usuarioId);
    }
    if (criterios.estado !== undefined) {
      condiciones.push('r.estado = ?');
      parametros.push(criterios.estado);
    }
    if (criterios.fecha !== undefined) {
      condiciones.push('r.fecha = ?');
      parametros.push(criterios.fecha);
    }

    const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const total = (this.conexion.prepare(`SELECT COUNT(*) AS n FROM reservas r ${donde}`).get(...parametros) as { n: number }).n;

    const filas = this.conexion
      .prepare(`${SELECT_RESERVA} ${donde} ORDER BY r.fecha DESC, r.hora_inicio ASC LIMIT ? OFFSET ?`)
      .all(...parametros, limite, (pagina - 1) * limite) as FilaReserva[];

    return { datos: filas.map(aReserva), total };
  }
}
