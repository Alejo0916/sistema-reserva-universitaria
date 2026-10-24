import type { RepositorioEventos } from '../../../db/repositorios/eventoRepo.js';
import type { RepositorioReservas } from '../../../db/repositorios/reservaRepo.js';
import type { Coleccion, ParametrosPaginacion } from '../../../shared/coleccion.js';
import { ERRORES } from '../../../domain/errores.js';
import type { CriteriosEvento, EventoRegistro } from '../domain/evento.js';

export interface DependenciasHistorial {
  eventos: RepositorioEventos;
  reservas: RepositorioReservas;
}

export class ServicioHistorial {
  constructor(private readonly deps: DependenciasHistorial) {}

  /** Historial de una reserva existente, en orden cronologico. */
  historialDeReserva(reservaId: number): EventoRegistro[] {
    const reserva = this.deps.reservas.buscarPorId(reservaId);
    if (reserva === null) {
      throw ERRORES.noEncontrado('reserva');
    }
    return this.deps.eventos.listarPorEntidad('RESERVA', reservaId);
  }

  /** Consulta global de la bitacora, con filtros opcionales. */
  listarEventos(criterios: CriteriosEvento, paginacion: ParametrosPaginacion): Coleccion<EventoRegistro> {
    const resultado = this.deps.eventos.listar(criterios, paginacion.pagina, paginacion.limite);
    return { datos: resultado.datos, total: resultado.total, ...paginacion };
  }
}
