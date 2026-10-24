export type TipoEvento =
  | 'RESERVA_CRIADA'
  | 'RESERVA_APROBADA'
  | 'RESERVA_RECHAZADA'
  | 'RESERVA_CANCELADA'
  | 'USUARIO_CREADO'
  | 'USUARIO_ACTUALIZADO'
  | 'USUARIO_DESACTIVADO'
  | 'USUARIO_CONTRASENA_RESTABLECIDA'
  | 'ESPACIO_CREADO'
  | 'ESPACIO_ACTUALIZADO'
  | 'ESPACIO_DESACTIVADO'
  | 'ESPACIO_ACTIVADO'
  | 'LOGIN_FALLIDO';

export interface EventoDominio {
  tipo: TipoEvento;
  actorId: number | null;
  entidadTipo: 'RESERVA' | 'USUARIO' | 'ESPACIO' | 'SESION';
  entidadId: number | null;
  datos: Record<string, unknown>;
}

export type SuscriptorEvento = (evento: EventoDominio) => void;

export interface BusEventos {
  suscribir(suscriptor: SuscriptorEvento): void;
  emitir(evento: EventoDominio): void;
}

/**
 * Bus de eventos sincrono en memoria.
 *
 * Se invoca SIEMPRE dentro de la transaccion de negocio que origina el
 * evento, de modo que si la escritura del evento falla, la transaccion
 * completa se revierte (ver design.md, decision D6).
 */
export function crearBusEventos(): BusEventos {
  const suscriptores: SuscriptorEvento[] = [];

  return {
    suscribir(suscriptor: SuscriptorEvento): void {
      suscriptores.push(suscriptor);
    },
    emitir(evento: EventoDominio): void {
      for (const suscriptor of suscriptores) {
        suscriptor(evento);
      }
    },
  };
}
