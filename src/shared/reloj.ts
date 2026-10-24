/**
 * Puerto de reloj del negocio.
 *
 * El tiempo del dominio se obtiene SIEMPRE a traves de este puerto para que
 * las pruebas que dependen de "ahora" (anticipacion minima, expiracion de
 * tokens, limite de intentos de inicio de sesion) sean deterministas.
 */
export interface Reloj {
  ahora(): Date;
}

export const relojReal: Reloj = {
  ahora: () => new Date(),
};

export function crearRelojFijo(instante: Date): Reloj {
  const copia = new Date(instante.getTime());
  return {
    ahora: () => new Date(copia.getTime()),
  };
}

export function crearRelojDesplazable(inicio: Date): Reloj & {
  avanzar(ms: number): void;
} {
  let actual = inicio.getTime();
  return {
    ahora: () => new Date(actual),
    avanzar: (ms: number) => {
      actual += ms;
    },
  };
}
