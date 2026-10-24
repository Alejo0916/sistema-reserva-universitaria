import type { Reloj } from '../../../shared/reloj.js';

export const MAXIMO_INTENTOS = 5;
export const VENTANA_MS = 15 * 60 * 1000;

interface EstadoIntento {
  fallos: number;
  ventanaDesde: number;
}

/**
 * Limitador de intentos de inicio de sesion por correo.
 *
 * Bloquea el inicio de sesion tras MAXIMO_INTENTOS fallos dentro de
 * VENTANA_MS. El bloqueo expira una vez transcurrida la ventana.
 *
 * Limitacion documentada (design.md, decision D9): el estado vive en la
 * memoria del proceso, por lo que el limite es por instancia. El despliegue
 * institucional de referencia es de una sola instancia.
 */
export class LimitadorIntentos {
  private readonly intentos = new Map<string, EstadoIntento>();

  constructor(
    private readonly reloj: Reloj,
    private readonly maximoIntentos: number = MAXIMO_INTENTOS,
    private readonly ventanaMs: number = VENTANA_MS,
  ) {}

  /** Registra un fallo y devuelve true si el correo ha quedado bloqueado. */
  registrarFallo(correo: string): boolean {
    const ahora = this.reloj.ahora().getTime();
    const existente = this.intentos.get(correo);

    if (existente === undefined || ahora - existente.ventanaDesde >= this.ventanaMs) {
      this.intentos.set(correo, { fallos: 1, ventanaDesde: ahora });
      return false;
    }

    existente.fallos += 1;
    return existente.fallos >= this.maximoIntentos;
  }

  /** Indica si el correo esta bloqueado en este momento. */
  estaBloqueado(correo: string): boolean {
    const existente = this.intentos.get(correo);
    if (existente === undefined) {
      return false;
    }
    const ahora = this.reloj.ahora().getTime();
    if (ahora - existente.ventanaDesde >= this.ventanaMs) {
      this.intentos.delete(correo);
      return false;
    }
    return existente.fallos >= this.maximoIntentos;
  }

  /** Limpia el registro tras un inicio de sesion correcto. */
  registrarExito(correo: string): void {
    this.intentos.delete(correo);
  }
}
