import type { EstadoReserva } from '../../../domain/tipos.js';

export interface Reserva {
  id: number;
  espacioId: number;
  usuarioId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  estado: EstadoReserva;
  justificacion: string;
  asistentes: number | null;
  motivo: string | null;
  revisorId: number | null;
  creadoEn: string;
  actualizadoEn: string;
}

/** Datos que devuelve la API al crear o consultar una reserva. */
export interface ReservaDetallada extends Reserva {
  espacioCodigo: string;
  espacioNombre: string;
  solicitanteNombre: string;
  solicitanteEmail: string;
  revisorNombre: string | null;
}

export interface SolicitudReserva {
  espacioId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  justificacion: string;
  asistentes: number | null;
}

export interface CriteriosReserva {
  espacioId?: number | undefined;
  usuarioId?: number | undefined;
  estado?: EstadoReserva | undefined;
  fecha?: string | undefined;
}
