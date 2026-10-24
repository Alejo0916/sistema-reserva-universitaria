import type { RepositorioEspacios } from '../../../db/repositorios/espacioRepo.js';
import type { RepositorioReservas } from '../../../db/repositorios/reservaRepo.js';
import { ERRORES } from '../../../domain/errores.js';
import {
  aMinutos,
  esFechaValida,
  formatearHora,
  restarIntervalos,
  type Intervalo,
} from '../../../domain/tiempo.js';
import type { Espacio } from '../../space-management/domain/espacio.js';

export interface FranjaOcupada {
  reservaId: number;
  horaInicio: string;
  horaFin: string;
  estado: string;
  solicitanteNombre: string;
}

export interface FranjaLibre {
  horaInicio: string;
  horaFin: string;
}

export interface DisponibilidadEspacio {
  espacio: Espacio;
  fecha: string;
  franja: { apertura: string; cierre: string };
  ocupado: FranjaOcupada[];
  libre: FranjaLibre[];
}

export interface DependenciasDisponibilidad {
  espacios: RepositorioEspacios;
  reservas: RepositorioReservas;
}

export class ServicioDisponibilidad {
  constructor(private readonly deps: DependenciasDisponibilidad) {}

  /**
   * Calcula la disponibilidad de un espacio en una fecha.
   *
   * Las franjas ocupadas son las de estado PENDIENTE o APROBADA (las que
   * ocupan la agenda). Las libres se obtienen restando las ocupadas de la
   * franja de funcionamiento del espacio.
   */
  consultar(referencia: string, fecha: string): DisponibilidadEspacio {
    if (!esFechaValida(fecha)) {
      throw ERRORES.validacion('La fecha no es valida', [
        { campo: 'fecha', mensaje: 'La fecha debe tener el formato YYYY-MM-DD y existir en el calendario' },
      ]);
    }

    const espacio = this.deps.espacios.buscarPorReferencia(referencia);
    if (espacio === null) {
      throw ERRORES.noEncontrado('espacio');
    }
    if (!espacio.activo) {
      throw ERRORES.espacioInactivo();
    }

    const reservas = this.deps.reservas.buscarSolapadas(
      espacio.id,
      fecha,
      espacio.horarioApertura,
      espacio.horarioCierre,
    );

    const ocupado: FranjaOcupada[] = reservas.map((reserva) => ({
      reservaId: reserva.id,
      horaInicio: reserva.horaInicio,
      horaFin: reserva.horaFin,
      estado: reserva.estado,
      solicitanteNombre: reserva.solicitanteNombre,
    }));

    const base: Intervalo = {
      inicio: aMinutos(espacio.horarioApertura),
      fin: aMinutos(espacio.horarioCierre),
    };
    const intervalosOcupados: Intervalo[] = reservas.map((reserva) => ({
      inicio: aMinutos(reserva.horaInicio),
      fin: aMinutos(reserva.horaFin),
    }));

    const libre: FranjaLibre[] = restarIntervalos(base, intervalosOcupados).map((intervalo) => ({
      horaInicio: formatearHora(intervalo.inicio),
      horaFin: formatearHora(intervalo.fin),
    }));

    return {
      espacio,
      fecha,
      franja: { apertura: espacio.horarioApertura, cierre: espacio.horarioCierre },
      ocupado,
      libre,
    };
  }
}
