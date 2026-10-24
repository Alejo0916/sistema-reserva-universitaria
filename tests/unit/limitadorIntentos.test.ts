import { describe, expect, it } from 'vitest';
import { LimitadorIntentos } from '../../src/modules/auth/domain/limitadorIntentos.js';
import { crearRelojDesplazable } from '../../src/shared/reloj.js';
import { contrasenaSegura } from '../../src/modules/auth/domain/contrasena.js';

describe('LimitadorIntentos', () => {
  it('bloquea el correo tras superar el maximo de intentos fallidos', () => {
    const reloj = crearRelojDesplazable(new Date('2026-03-16T08:00:00Z'));
    const limitador = new LimitadorIntentos(reloj);

    for (let intento = 1; intento <= 4; intento += 1) {
      expect(limitador.registrarFallo('a@uni.edu')).toBe(false);
    }
    expect(limitador.registrarFallo('a@uni.edu')).toBe(true);
    expect(limitador.estaBloqueado('a@uni.edu')).toBe(true);
  });

  it('expira el bloqueo una vez transcurrida la ventana', () => {
    const reloj = crearRelojDesplazable(new Date('2026-03-16T08:00:00Z'));
    const limitador = new LimitadorIntentos(reloj);

    for (let intento = 1; intento <= 5; intento += 1) {
      limitador.registrarFallo('a@uni.edu');
    }
    expect(limitador.estaBloqueado('a@uni.edu')).toBe(true);

    reloj.avanzar(16 * 60 * 1000);

    expect(limitador.estaBloqueado('a@uni.edu')).toBe(false);
  });

  it('reinicia el contador tras la ventana aunque no se compruebe el bloqueo', () => {
    const reloj = crearRelojDesplazable(new Date('2026-03-16T08:00:00Z'));
    const limitador = new LimitadorIntentos(reloj);

    limitador.registrarFallo('a@uni.edu');
    reloj.avanzar(16 * 60 * 1000);
    limitador.registrarFallo('a@uni.edu');

    expect(limitador.estaBloqueado('a@uni.edu')).toBe(false);
  });

  it('no bloquea a otros correos', () => {
    const reloj = crearRelojDesplazable(new Date('2026-03-16T08:00:00Z'));
    const limitador = new LimitadorIntentos(reloj);

    for (let intento = 1; intento <= 5; intento += 1) {
      limitador.registrarFallo('a@uni.edu');
    }

    expect(limitador.estaBloqueado('b@uni.edu')).toBe(false);
  });

  it('limpia el registro tras un inicio de sesion correcto', () => {
    const reloj = crearRelojDesplazable(new Date('2026-03-16T08:00:00Z'));
    const limitador = new LimitadorIntentos(reloj);

    for (let intento = 1; intento <= 5; intento += 1) {
      limitador.registrarFallo('a@uni.edu');
    }
    limitador.registrarExito('a@uni.edu');

    expect(limitador.estaBloqueado('a@uni.edu')).toBe(false);
  });
});

describe('contrasenaSegura', () => {
  it('acepta contrasenas con al menos 8 caracteres, una letra y un digito', () => {
    expect(contrasenaSegura('clave1234')).toBe(true);
    expect(contrasenaSegura('Abcdefg1')).toBe(true);
  });

  it('rechaza contrasenas cortas', () => {
    expect(contrasenaSegura('clave12')).toBe(false);
  });

  it('rechaza contrasenas sin digito', () => {
    expect(contrasenaSegura('claveseguras')).toBe(false);
  });

  it('rechaza contrasenas sin letra', () => {
    expect(contrasenaSegura('12345678')).toBe(false);
  });
});
