import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { crearServicioTokens } from '../../src/modules/auth/domain/token.js';
import { cargarConfig } from '../../src/shared/config.js';
import { crearBusEventos } from '../../src/shared/eventBus.js';
import { calcularPaginacion, LIMITE_MAXIMO, LIMITE_POR_DEFECTO } from '../../src/shared/coleccion.js';
import { esPermisoConocido, CATALOGO_PERMISOS, CATALOGO_ROLES } from '../../src/modules/rbac/domain/catalogo.js';
import { abrirConexion, aplicarEsquema, verificarIntegridad } from '../../src/db/conexion.js';
import { enTransaccion } from '../../src/db/transaccion.js';
import { crearRelojDesplazable, crearRelojFijo } from '../../src/shared/reloj.js';

describe('servicio de tokens', () => {
  const secreto = 'secreto-de-pruebas-suficientemente-largo-1234';
  const tokens = crearServicioTokens(secreto, '2h');

  it('emite un token con el identificador y la version de token', () => {
    const token = tokens.emitir(7, 3);
    const contenido = tokens.verificar(token);

    expect(contenido).not.toBeNull();
    expect(contenido?.sub).toBe(7);
    expect(contenido?.tv).toBe(3);
  });

  it('NO incluye el rol ni los permisos en el token', () => {
    const token = tokens.emitir(7, 1);
    const decodificado = jwt.decode(token) as Record<string, unknown>;

    expect(decodificado['sub']).toBe(7);
    expect(decodificado['rol']).toBeUndefined();
    expect(decodificado['permisos']).toBeUndefined();
  });

  it('rechaza un token firmado con otro secreto', () => {
    const otro = jwt.sign({ sub: 1, tv: 1 }, 'otro-secreto-distinto-1234567890', { expiresIn: '2h' });
    expect(tokens.verificar(otro)).toBeNull();
  });

  it('rechaza un token expirado', () => {
    const expirado = jwt.sign({ sub: 1, tv: 1 }, secreto, { expiresIn: '-1s' });
    expect(tokens.verificar(expirado)).toBeNull();
  });

  it('rechaza un token con un contenido inesperado', () => {
    const invalido = jwt.sign({ otro: 'dato' }, secreto, { expiresIn: '2h' });
    expect(tokens.verificar(invalido)).toBeNull();
  });

  it('rechaza una cadena que no es un token', () => {
    expect(tokens.verificar('no-es-un-token')).toBeNull();
  });
});

describe('configuracion', () => {
  const base = { JWT_SECRET: 'secreto-de-pruebas-suficientemente-largo-1234' };

  it('aplica los valores por defecto', () => {
    const config = cargarConfig(base);

    expect(config.puerto).toBe(3000);
    expect(config.rutaBaseDatos).toBe('./data/sigrea.db');
    expect(config.horarioAperturaPorDefecto).toBe('08:00');
    expect(config.horarioCierrePorDefecto).toBe('22:00');
    expect(config.anticipacionMinimaHoras).toBe(2);
    expect(config.duracionMinimaMinutos).toBe(15);
    expect(config.nivelLog).toBe('info');
    expect(config.esProduccion).toBe(false);
  });

  it('lee los valores del entorno', () => {
    const config = cargarConfig({
      ...base,
      PUERTO: '8080',
      ANTICIPACION_MINIMA_HORAS: '6',
      LOG_LEVEL: 'debug',
      NODE_ENV: 'production',
    });

    expect(config.puerto).toBe(8080);
    expect(config.anticipacionMinimaHoras).toBe(6);
    expect(config.nivelLog).toBe('debug');
    expect(config.esProduccion).toBe(true);
  });

  it('rechaza un puerto no numerico', () => {
    expect(() => cargarConfig({ ...base, PUERTO: 'no-es-un-puerto' })).toThrow(/numerica/);
  });

  it('rechaza un nivel de log desconocido', () => {
    expect(() => cargarConfig({ ...base, LOG_LEVEL: 'verboso' })).toThrow(/LOG_LEVEL/);
  });

  it('exige un secreto de al menos 16 caracteres', () => {
    expect(() => cargarConfig({ JWT_SECRET: 'corto' })).toThrow(/al menos 16 caracteres/);
  });

  it('exige un secreto de al menos 32 caracteres en produccion', () => {
    expect(() =>
      cargarConfig({ JWT_SECRET: 'un-secreto-de-20-caracteres', NODE_ENV: 'production' }),
    ).toThrow(/al menos 32 caracteres/);
  });
});

describe('bus de eventos', () => {
  it('entrega los eventos a los suscriptores en orden de suscripcion', () => {
    const bus = crearBusEventos();
    const recibidos: string[] = [];

    bus.suscribir((evento) => {
      recibidos.push(`primero:${evento.tipo}`);
    });
    bus.suscribir((evento) => {
      recibidos.push(`segundo:${evento.tipo}`);
    });

    bus.emitir({ tipo: 'RESERVA_CRIADA', actorId: 1, entidadTipo: 'RESERVA', entidadId: 1, datos: {} });

    expect(recibidos).toEqual(['primero:RESERVA_CRIADA', 'segundo:RESERVA_CRIADA']);
  });

  it('propaga el error si un suscriptor falla', () => {
    const bus = crearBusEventos();
    bus.suscribir(() => {
      throw new Error('fallo de escritura del evento');
    });

    expect(() =>
      bus.emitir({ tipo: 'RESERVA_CRIADA', actorId: 1, entidadTipo: 'RESERVA', entidadId: 1, datos: {} }),
    ).toThrow('fallo de escritura del evento');
  });
});

describe('paginacion', () => {
  it('usa los valores por defecto cuando no se indican', () => {
    expect(calcularPaginacion(undefined, undefined)).toEqual({
      pagina: 1,
      limite: LIMITE_POR_DEFECTO,
    });
  });

  it('acepta pagina y limite validos', () => {
    expect(calcularPaginacion('3', '50')).toEqual({ pagina: 3, limite: 50 });
  });

  it('limita el limite al maximo permitido', () => {
    expect(calcularPaginacion(1, '5000').limite).toBe(LIMITE_MAXIMO);
  });

  it('descarta valores no numericos o no positivos', () => {
    expect(calcularPaginacion('abc', '-5')).toEqual({ pagina: 1, limite: LIMITE_POR_DEFECTO });
    expect(calcularPaginacion('0', '0')).toEqual({ pagina: 1, limite: LIMITE_POR_DEFECTO });
  });
});

describe('catalogo de permisos y roles', () => {
  it('reconoce los permisos del catalogo', () => {
    expect(esPermisoConocido('espacios:leer')).toBe(true);
    expect(esPermisoConocido('espacios:borrar')).toBe(false);
  });

  it('declara cuatro roles y diez permisos', () => {
    expect(CATALOGO_ROLES).toHaveLength(4);
    expect(CATALOGO_PERMISOS).toHaveLength(10);
  });

  it('da al ADMIN todos los permisos del catalogo', () => {
    const admin = CATALOGO_ROLES.find((rol) => rol.nombre === 'ADMIN');
    expect(admin?.permisos).toHaveLength(CATALOGO_PERMISOS.length);
  });
});

describe('conexion y transacciones', () => {
  it('comprueba la integridad de la base de datos', () => {
    const conexion = abrirConexion({ ruta: ':memory:' });
    try {
      aplicarEsquema(conexion);
      expect(verificarIntegridad(conexion)).toBe(true);
    } finally {
      conexion.close();
    }
  });

  it('confirma la transaccion cuando la operacion termina bien', () => {
    const conexion = abrirConexion({ ruta: ':memory:' });
    try {
      aplicarEsquema(conexion);
      enTransaccion(conexion, () => {
        conexion.prepare('INSERT INTO roles (nombre, descripcion) VALUES (?, ?)').run('ADMIN', 'Administrador');
      });
      const fila = conexion.prepare('SELECT COUNT(*) AS n FROM roles').get() as { n: number };
      expect(fila.n).toBe(1);
    } finally {
      conexion.close();
    }
  });

  it('revierte la transaccion cuando la operacion falla', () => {
    const conexion = abrirConexion({ ruta: ':memory:' });
    try {
      aplicarEsquema(conexion);
      expect(() =>
        enTransaccion(conexion, () => {
          conexion.prepare('INSERT INTO roles (nombre, descripcion) VALUES (?, ?)').run('ADMIN', 'Administrador');
          throw new Error('fallo intencionado');
        }),
      ).toThrow('fallo intencionado');

      const fila = conexion.prepare('SELECT COUNT(*) AS n FROM roles').get() as { n: number };
      expect(fila.n).toBe(0);
    } finally {
      conexion.close();
    }
  });
});

describe('reloj de negocio', () => {
  it('el reloj fijo siempre devuelve el mismo instante', () => {
    const reloj = crearRelojFijo(new Date(2026, 2, 16, 8, 0, 0));
    expect(reloj.ahora().getTime()).toBe(new Date(2026, 2, 16, 8, 0, 0).getTime());
  });

  it('el reloj desplazable avanza de forma controlada', () => {
    const reloj = crearRelojDesplazable(new Date(2026, 2, 16, 8, 0, 0));
    const inicial = reloj.ahora().getTime();
    reloj.avanzar(60_000);
    expect(reloj.ahora().getTime()).toBe(inicial + 60_000);
  });
});
