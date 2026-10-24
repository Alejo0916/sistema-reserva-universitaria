import { describe, expect, it } from 'vitest';
import { ErrorDominio, ERRORES } from '../../src/domain/errores.js';
import { transicionValida, esEstadoReserva, esTipoEspacio, esRol } from '../../src/domain/tipos.js';

describe('ErrorDominio', () => {
  it('transporta codigo, estado y detalles', () => {
    const error = new ErrorDominio('CODIGO', 'Mensaje', 418, { detalles: [{ campo: 'x', mensaje: 'detalle' }] });

    expect(error.codigo).toBe('CODIGO');
    expect(error.estado).toBe(418);
    expect(error.detalles).toHaveLength(1);
    expect(error).toBeInstanceOf(Error);
  });

  it('usa una lista de detalles vacia por defecto', () => {
    expect(new ErrorDominio('CODIGO', 'Mensaje', 400).detalles).toEqual([]);
  });
});

describe('catalogo de errores', () => {
  it('mapea cada familia de error a su estado HTTP', () => {
    expect(ERRORES.validacion().estado).toBe(422);
    expect(ERRORES.noAutenticado().estado).toBe(401);
    expect(ERRORES.credencialesInvalidas().estado).toBe(401);
    expect(ERRORES.demasiadosIntentos().estado).toBe(429);
    expect(ERRORES.permisoDenegado('x').estado).toBe(403);
    expect(ERRORES.autoAprobacionProhibida().estado).toBe(403);
    expect(ERRORES.noEncontrado('reserva').estado).toBe(404);
    expect(ERRORES.duplicado('EMAIL_DUPLICADO', 'x').estado).toBe(409);
    expect(ERRORES.estadoInvalido().estado).toBe(409);
    expect(ERRORES.espacioOcupado().estado).toBe(409);
    expect(ERRORES.espacioInactivo().estado).toBe(409);
    expect(ERRORES.espacioConReservasActivas().estado).toBe(409);
    expect(ERRORES.anticipacionInsuficiente().estado).toBe(422);
    expect(ERRORES.fueraDeHorario().estado).toBe(422);
    expect(ERRORES.capacidadExcedida().estado).toBe(422);
    expect(ERRORES.rolNoPermitido().estado).toBe(422);
    expect(ERRORES.rolDesconocido().estado).toBe(422);
    expect(ERRORES.tipoEspacioDesconocido().estado).toBe(422);
    expect(ERRORES.automodificacionProhibida().estado).toBe(409);
  });

  it('deriva el codigo del recurso no encontrado', () => {
    expect(ERRORES.noEncontrado('reserva').codigo).toBe('RESERVA_NO_ENCONTRADA');
    expect(ERRORES.noEncontrado('espacio').codigo).toBe('ESPACIO_NO_ENCONTRADO');
    expect(ERRORES.noEncontrado('usuario').codigo).toBe('USUARIO_NO_ENCONTRADO');
  });

  it('incluye el permiso en el mensaje de permiso denegado', () => {
    expect(ERRORES.permisoDenegado('reservas:aprobar').message).toContain('reservas:aprobar');
  });
});

describe('transiciones de estado de la reserva', () => {
  it('permite las transiciones validas', () => {
    expect(transicionValida('PENDIENTE', 'APROBADA')).toBe(true);
    expect(transicionValida('PENDIENTE', 'RECHAZADA')).toBe(true);
    expect(transicionValida('PENDIENTE', 'CANCELADA')).toBe(true);
    expect(transicionValida('APROBADA', 'CANCELADA')).toBe(true);
  });

  it('rechaza las transiciones invalidas', () => {
    expect(transicionValida('APROBADA', 'APROBADA')).toBe(false);
    expect(transicionValida('APROBADA', 'RECHAZADA')).toBe(false);
    expect(transicionValida('RECHAZADA', 'APROBADA')).toBe(false);
    expect(transicionValida('RECHAZADA', 'CANCELADA')).toBe(false);
    expect(transicionValida('CANCELADA', 'APROBADA')).toBe(false);
    expect(transicionValida('CANCELADA', 'CANCELADA')).toBe(false);
  });
});

describe('guardas de catalogo', () => {
  it('reconoce los estados de reserva validos', () => {
    expect(esEstadoReserva('PENDIENTE')).toBe(true);
    expect(esEstadoReserva('INVENTADO')).toBe(false);
  });

  it('reconoce los tipos de espacio validos', () => {
    expect(esTipoEspacio('AUDITORIO')).toBe(true);
    expect(esTipoEspacio('CAFETERIA')).toBe(false);
  });

  it('reconoce los roles validos', () => {
    expect(esRol('COORDINADOR')).toBe(true);
    expect(esRol('SUPERADMIN')).toBe(false);
  });
});
