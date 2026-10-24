export interface Coleccion<T> {
  datos: T[];
  total: number;
  pagina: number;
  limite: number;
}

export interface ParametrosPaginacion {
  pagina: number;
  limite: number;
}

export const LIMITE_POR_DEFECTO = 20;
export const LIMITE_MAXIMO = 100;

export function calcularPaginacion(pagina: unknown, limite: unknown): ParametrosPaginacion {
  const paginaNumerica = Number(pagina);
  const limiteNumerico = Number(limite);

  const paginaValida = Number.isFinite(paginaNumerica) && paginaNumerica >= 1 ? Math.floor(paginaNumerica) : 1;
  const limiteValido =
    Number.isFinite(limiteNumerico) && limiteNumerico >= 1
      ? Math.min(Math.floor(limiteNumerico), LIMITE_MAXIMO)
      : LIMITE_POR_DEFECTO;

  return { pagina: paginaValida, limite: limiteValido };
}
