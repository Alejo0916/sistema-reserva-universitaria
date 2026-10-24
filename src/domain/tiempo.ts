/**
 * Reglas puras de tiempo del dominio.
 *
 * El modelo temporal del sistema es "fecha civil + hora local" en formato
 * `YYYY-MM-DD` y `HH:MM` (ver design.md, decision D2). Las franjas son
 * semiabiertas [inicio, fin): dos franjas que se tocan en un extremo no se
 * solapan.
 */

export const MINUTOS_POR_DIA = 24 * 60;

const RE_ORA = /^([01]\d|2[0-3]):([0-5]\d)$/;
const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/;

export interface Intervalo {
  inicio: number;
  fin: number;
}

export interface IntervaloTexto {
  inicio: string;
  fin: string;
}

/** Convierte una hora `HH:MM` en minutos desde la medianoche. */
export function aMinutos(hora: string): number {
  const coincidencia = RE_ORA.exec(hora);
  if (coincidencia === null) {
    throw new Error(`Hora invalida: "${hora}", se espera el formato HH:MM`);
  }
  const horas = Number(coincidencia[1]);
  const minutos = Number(coincidencia[2]);
  return horas * 60 + minutos;
}

/** Convierte minutos desde la medianoche en una hora `HH:MM`. */
export function formatearHora(minutos: number): string {
  if (!Number.isInteger(minutos) || minutos < 0 || minutos >= MINUTOS_POR_DIA) {
    throw new Error(`Minutos invalidos: ${minutos}`);
  }
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `${String(horas).padStart(2, '0')}:${String(resto).padStart(2, '0')}`;
}

/** Minutos de duracion de una franja `HH:MM` - `HH:MM`. */
export function minutosEntre(inicio: string, fin: string): number {
  return aMinutos(fin) - aMinutos(inicio);
}

/** Valida que una fecha tenga formato `YYYY-MM-DD` y exista en el calendario. */
export function esFechaValida(fecha: string): boolean {
  const coincidencia = RE_FECHA.exec(fecha);
  if (coincidencia === null) {
    return false;
  }
  const anio = Number(coincidencia[1]);
  const mes = Number(coincidencia[2]);
  const dia = Number(coincidencia[3]);
  if (mes < 1 || mes > 12 || dia < 1) {
    return false;
  }
  const diasEnMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  return dia <= diasEnMes;
}

/** Indica si la fecha es anterior a la fecha de referencia (`YYYY-MM-DD`). */
export function esFechaPasada(fecha: string, fechaReferencia: string): boolean {
  return fecha < fechaReferencia;
}

/** Indica si la fecha es posterior a la fecha de referencia. */
export function esFechaFutura(fecha: string, fechaReferencia: string): boolean {
  return fecha > fechaReferencia;
}

/**
 * Indica si dos intervalos semiabiertos se solapan.
 * Los intervalos que solo se tocan en un extremo NO se solapan.
 */
export function solapan(a: Intervalo, b: Intervalo): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/** Indica si dos intervalos de texto (`HH:MM`) se solapan. */
export function solapanTexto(a: IntervaloTexto, b: IntervaloTexto): boolean {
  return solapan({ inicio: aMinutos(a.inicio), fin: aMinutos(a.fin) }, { inicio: aMinutos(b.inicio), fin: aMinutos(b.fin) });
}

/**
 * Une intervalos que se tocan o se solapan, devolviendo bloques disjuntos
 * ordenados por inicio. Se usa para calcular las franjas libres y la
 * union de horas consecutivas de un mismo usuario.
 */
export function fusionarIntervalos(intervalos: Intervalo[]): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicio - b.inicio || a.fin - b.fin);
  const fusionados: Intervalo[] = [];

  for (const intervalo of ordenados) {
    const ultimo = fusionados[fusionados.length - 1];
    if (ultimo !== undefined && intervalo.inicio <= ultimo.fin) {
      ultimo.fin = Math.max(ultimo.fin, intervalo.fin);
    } else {
      fusionados.push({ inicio: intervalo.inicio, fin: intervalo.fin });
    }
  }

  return fusionados;
}

/** Resta un conjunto de intervalos ocupados de una franja base. */
export function restarIntervalos(base: Intervalo, ocupados: Intervalo[]): Intervalo[] {
  const fusionadosOcupados = fusionarIntervalos(ocupados);
  const resultado: Intervalo[] = [];
  let cursor = base.inicio;

  for (const ocupado of fusionadosOcupados) {
    if (ocupado.fin <= base.inicio || ocupado.inicio >= base.fin) {
      continue;
    }
    if (ocupado.inicio > cursor) {
      resultado.push({ inicio: cursor, fin: Math.min(ocupado.inicio, base.fin) });
    }
    cursor = Math.max(cursor, ocupado.fin);
    if (cursor >= base.fin) {
      break;
    }
  }

  if (cursor < base.fin) {
    resultado.push({ inicio: cursor, fin: base.fin });
  }

  return resultado;
}

/** Devuelve la fecha civil (`YYYY-MM-DD`) de un instante, en hora local. */
export function fechaCivil(instante: Date): string {
  const anio = instante.getFullYear();
  const mes = String(instante.getMonth() + 1).padStart(2, '0');
  const dia = String(instante.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

/** Devuelve la marca de tiempo ISO-8601 de un instante. */
export function marcaTiempo(instante: Date): string {
  return instante.toISOString();
}
