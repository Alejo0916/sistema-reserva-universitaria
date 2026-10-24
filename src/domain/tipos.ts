export const ESTADOS_RESERVA = ['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA'] as const;
export type EstadoReserva = (typeof ESTADOS_RESERVA)[number];

export const TIPOS_ESPACIO = [
  'LABORATORIO',
  'AUDITORIO',
  'SALA_COMPUTO',
  'SALA_REUNION',
  'SEMINARIO',
] as const;
export type TipoEspacio = (typeof TIPOS_ESPACIO)[number];

export const ROLES = ['ADMIN', 'COORDINADOR', 'DOCENTE', 'ESTUDIANTE'] as const;
export type Rol = (typeof ROLES)[number];

/** Estados que ocupan la franja horaria del espacio. */
export const ESTADOS_ACTIVOS: readonly EstadoReserva[] = ['PENDIENTE', 'APROBADA'];

export function esEstadoReserva(valor: string): valor is EstadoReserva {
  return (ESTADOS_RESERVA as readonly string[]).includes(valor);
}

export function esTipoEspacio(valor: string): valor is TipoEspacio {
  return (TIPOS_ESPACIO as readonly string[]).includes(valor);
}

export function esRol(valor: string): valor is Rol {
  return (ROLES as readonly string[]).includes(valor);
}

/**
 * Transiciones validas de estado de una reserva.
 * Los estados terminales (RECHAZADA, CANCELADA) no admiten transicion.
 */
export const TRANSICIONES: Readonly<Record<EstadoReserva, readonly EstadoReserva[]>> = {
  PENDIENTE: ['APROBADA', 'RECHAZADA', 'CANCELADA'],
  APROBADA: ['CANCELADA'],
  RECHAZADA: [],
  CANCELADA: [],
};

export function transicionValida(desde: EstadoReserva, hacia: EstadoReserva): boolean {
  return TRANSICIONES[desde].includes(hacia);
}
