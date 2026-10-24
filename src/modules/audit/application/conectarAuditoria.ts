import type { RepositorioEventos } from '../../../db/repositorios/eventoRepo.js';
import type { BusEventos, EventoDominio } from '../../../shared/eventBus.js';
import type { Reloj } from '../../../shared/reloj.js';
import { marcaTiempo } from '../../../domain/tiempo.js';

/**
 * Suscriptor del bus de eventos que persiste la bitacora.
 *
 * Se invoca dentro de la transaccion de negocio que origina el evento, de
 * modo que un fallo al escribir el evento revierte tambien el cambio de
 * negocio (design.md, decision D6).
 */
export function conectarAuditoria(bus: BusEventos, eventos: RepositorioEventos, reloj: Reloj): void {
  bus.suscribir((evento: EventoDominio) => {
    eventos.registrar({
      tipo: evento.tipo,
      actorId: evento.actorId,
      entidadTipo: evento.entidadTipo,
      entidadId: evento.entidadId,
      datos: evento.datos,
      creadoEn: marcaTiempo(reloj.ahora()),
    });
  });
}
