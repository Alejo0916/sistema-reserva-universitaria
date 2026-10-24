import type { Conexion } from '../conexion.js';
import type { CriteriosEvento, EventoRegistro } from '../../modules/reservation-history/domain/evento.js';

interface FilaEvento {
  id: number;
  tipo: string;
  actor_id: number | null;
  actor_nombre: string | null;
  entidad_tipo: string;
  entidad_id: number | null;
  datos: string;
  creado_en: string;
}

function aEvento(fila: FilaEvento): EventoRegistro {
  let datos: Record<string, unknown> = {};
  try {
    datos = JSON.parse(fila.datos) as Record<string, unknown>;
  } catch {
    datos = {};
  }
  return {
    id: fila.id,
    tipo: fila.tipo,
    actorId: fila.actor_id,
    actorNombre: fila.actor_nombre,
    entidadTipo: fila.entidad_tipo,
    entidadId: fila.entidad_id,
    datos,
    creadoEn: fila.creado_en,
  };
}

const SELECT_EVENTO = `
  SELECT ev.id, ev.tipo, ev.actor_id, u.nombre AS actor_nombre,
         ev.entidad_tipo, ev.entidad_id, ev.datos, ev.creado_en
  FROM eventos ev
  LEFT JOIN usuarios u ON u.id = ev.actor_id
`;

export class RepositorioEventos {
  constructor(private readonly conexion: Conexion) {}

  registrar(evento: {
    tipo: string;
    actorId: number | null;
    entidadTipo: string;
    entidadId: number | null;
    datos: Record<string, unknown>;
    creadoEn: string;
  }): number {
    const resultado = this.conexion
      .prepare(
        `INSERT INTO eventos (tipo, actor_id, entidad_tipo, entidad_id, datos, creado_en)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        evento.tipo,
        evento.actorId,
        evento.entidadTipo,
        evento.entidadId,
        JSON.stringify(evento.datos),
        evento.creadoEn,
      );
    return Number(resultado.lastInsertRowid);
  }

  listarPorEntidad(entidadTipo: string, entidadId: number): EventoRegistro[] {
    const filas = this.conexion
      .prepare(`${SELECT_EVENTO} WHERE ev.entidad_tipo = ? AND ev.entidad_id = ? ORDER BY ev.id ASC`)
      .all(entidadTipo, entidadId) as FilaEvento[];
    return filas.map(aEvento);
  }

  listar(criterios: CriteriosEvento, pagina: number, limite: number): { datos: EventoRegistro[]; total: number } {
    const condiciones: string[] = [];
    const parametros: unknown[] = [];

    if (criterios.tipo !== undefined) {
      condiciones.push('ev.tipo = ?');
      parametros.push(criterios.tipo);
    }
    if (criterios.entidadTipo !== undefined) {
      condiciones.push('ev.entidad_tipo = ?');
      parametros.push(criterios.entidadTipo);
    }
    if (criterios.entidadId !== undefined) {
      condiciones.push('ev.entidad_id = ?');
      parametros.push(criterios.entidadId);
    }
    if (criterios.desde !== undefined) {
      condiciones.push('ev.creado_en >= ?');
      parametros.push(criterios.desde);
    }
    if (criterios.hasta !== undefined) {
      condiciones.push('ev.creado_en <= ?');
      parametros.push(criterios.hasta);
    }

    const donde = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const total = (this.conexion.prepare(`SELECT COUNT(*) AS n FROM eventos ev ${donde}`).get(...parametros) as { n: number }).n;

    const filas = this.conexion
      .prepare(`${SELECT_EVENTO} ${donde} ORDER BY ev.id DESC LIMIT ? OFFSET ?`)
      .all(...parametros, limite, (pagina - 1) * limite) as FilaEvento[];

    return { datos: filas.map(aEvento), total };
  }
}
