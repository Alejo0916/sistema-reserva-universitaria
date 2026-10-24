export type NivelLog = 'debug' | 'info' | 'warn' | 'error';

export interface Config {
  puerto: number;
  host: string;
  rutaBaseDatos: string;
  secretoJwt: string;
  duracionTokenJwt: string;
  horarioAperturaPorDefecto: string;
  horarioCierrePorDefecto: string;
  anticipacionMinimaHoras: number;
  duracionMinimaMinutos: number;
  limiteHorasConsecutivasMinutos: number;
  origenCors: string;
  nivelLog: NivelLog;
  esProduccion: boolean;
}

const NIVELES: readonly NivelLog[] = ['debug', 'info', 'warn', 'error'];

function leerNumero(nombre: string, valor: string | undefined, porDefecto: number): number {
  if (valor === undefined || valor.trim() === '') {
    return porDefecto;
  }
  const parsed = Number(valor);
  if (!Number.isFinite(parsed)) {
    throw new Error(`La variable de entorno ${nombre} debe ser numerica, se recibio "${valor}"`);
  }
  return parsed;
}

function leerTexto(_nombre: string, valor: string | undefined, porDefecto: string): string {
  if (valor === undefined || valor.trim() === '') {
    return porDefecto;
  }
  return valor.trim();
}

function leerNivel(valor: string | undefined, porDefecto: NivelLog): NivelLog {
  if (valor === undefined || valor.trim() === '') {
    return porDefecto;
  }
  const normalizado = valor.trim().toLowerCase() as NivelLog;
  if (!NIVELES.includes(normalizado)) {
    throw new Error(`La variable de entorno LOG_LEVEL debe ser uno de: ${NIVELES.join(', ')}`);
  }
  return normalizado;
}

/**
 * Lee el limite de horas consecutivas y lo devuelve en minutos.
 *
 * La variable de entorno se expresa en horas porque es la unidad en que la
 * institucion formula la regla ("mas de cuatro horas consecutivas"), pero
 * el computo se hace en minutos para que los bordes del limite sean
 * exactos (design.md del change `limit-4-horas-consecutivas`, decision D1).
 */
function leerLimiteHorasConsecutivas(valor: string | undefined, porDefecto: number): number {
  const horas = leerNumero('LIMITE_HORAS_CONSECUTIVAS', valor, porDefecto);
  if (horas <= 0) {
    throw new Error('La variable de entorno LIMITE_HORAS_CONSECUTIVAS debe ser mayor que cero');
  }
  return Math.round(horas * 60);
}

export function cargarConfig(entorno: NodeJS.ProcessEnv = process.env): Config {
  const esProduccion = leerTexto('NODE_ENV', entorno.NODE_ENV, 'development') === 'production';
  const secretoJwt = leerTexto('JWT_SECRET', entorno.JWT_SECRET, '');

  if (esProduccion && secretoJwt.length < 32) {
    throw new Error('JWT_SECRET debe tener al menos 32 caracteres en produccion');
  }
  if (secretoJwt.length < 16) {
    throw new Error('JWT_SECRET debe tener al menos 16 caracteres');
  }

  return {
    puerto: leerNumero('PUERTO', entorno.PUERTO, 3000),
    host: leerTexto('HOST', entorno.HOST, '0.0.0.0'),
    rutaBaseDatos: leerTexto('DATABASE_URL', entorno.DATABASE_URL, './data/sigrea.db'),
    secretoJwt,
    duracionTokenJwt: leerTexto('JWT_EXPIRES_IN', entorno.JWT_EXPIRES_IN, '2h'),
    horarioAperturaPorDefecto: leerTexto('ESPACIO_HORARIO_APERTURA', entorno.ESPACIO_HORARIO_APERTURA, '08:00'),
    horarioCierrePorDefecto: leerTexto('ESPACIO_HORARIO_CIERRE', entorno.ESPACIO_HORARIO_CIERRE, '22:00'),
    anticipacionMinimaHoras: leerNumero('ANTICIPACION_MINIMA_HORAS', entorno.ANTICIPACION_MINIMA_HORAS, 2),
    duracionMinimaMinutos: leerNumero('DURACION_MINIMA_MINUTOS', entorno.DURACION_MINIMA_MINUTOS, 15),
    limiteHorasConsecutivasMinutos: leerLimiteHorasConsecutivas(
      entorno.LIMITE_HORAS_CONSECUTIVAS,
      4,
    ),
    origenCors: leerTexto('CORS_ORIGIN', entorno.CORS_ORIGIN, 'http://localhost:3000'),
    nivelLog: leerNivel(entorno.LOG_LEVEL, 'info'),
    esProduccion,
  };
}
