import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearEntornoPrueba, type EntornoPrueba } from '../helpers/entorno.js';
import { iniciarSesion } from '../helpers/sesiones.js';

describe('availability - API', () => {
  let entorno: EntornoPrueba;
  let tokenDocente: string;
  let tokenAdmin: string;

  beforeAll(async () => {
    entorno = crearEntornoPrueba();
    const docente = await iniciarSesion(entorno.app, 'docente@uni.edu', 'docen1234');
    const admin = await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234');
    tokenDocente = docente.token;
    tokenAdmin = admin.token;

    await request(entorno.app)
      .post('/api/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ codigo: 'LAB-101', nombre: 'Laboratorio', tipo: 'LABORATORIO', capacidad: 24 });
  });

  afterAll(() => {
    entorno.cerrar();
  });

  async function reservar(espacioId: number, fecha: string, horaInicio: string, horaFin: string) {
    return request(entorno.app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${tokenDocente}`)
      .send({ espacioId, fecha, horaInicio, horaFin, justificacion: 'Reserva de prueba automatizada' });
  }

  it('devuelve la franja completa cuando el dia no tiene reservas', async () => {
    const respuesta = await request(entorno.app)
      .get('/api/espacios/LAB-101/disponibilidad?fecha=2026-03-17')
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ocupado).toEqual([]);
    expect(respuesta.body.libre).toEqual([{ horaInicio: '08:00', horaFin: '22:00' }]);
  });

  it('divide la franja en dos cuando hay una reserva intermedia', async () => {
    await reservar(1, '2026-03-18', '10:00', '12:00');

    const respuesta = await request(entorno.app)
      .get('/api/espacios/LAB-101/disponibilidad?fecha=2026-03-18')
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.libre).toEqual([
      { horaInicio: '08:00', horaFin: '10:00' },
      { horaInicio: '12:00', horaFin: '22:00' },
    ]);
  });

  it('indica los datos de la franja ocupada', async () => {
    const respuesta = await request(entorno.app)
      .get('/api/espacios/LAB-101/disponibilidad?fecha=2026-03-18')
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.body.ocupado).toHaveLength(1);
    expect(respuesta.body.ocupado[0].horaInicio).toBe('10:00');
    expect(respuesta.body.ocupado[0].horaFin).toBe('12:00');
    expect(respuesta.body.ocupado[0].estado).toBe('PENDIENTE');
    expect(respuesta.body.ocupado[0].solicitanteNombre).toBe('Docente de Prueba');
    expect(typeof respuesta.body.ocupado[0].reservaId).toBe('number');
  });

  it('no cuenta como ocupadas las reservas en estado terminal', async () => {
    const creada = await reservar(1, '2026-03-19', '10:00', '12:00');
    const admin = await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234');

    await request(entorno.app)
      .post(`/api/reservas/${creada.body.id}/rechazar`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ motivo: 'El laboratorio estara en mantenimiento ese dia' });

    const respuesta = await request(entorno.app)
      .get('/api/espacios/LAB-101/disponibilidad?fecha=2026-03-19')
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.body.ocupado).toEqual([]);
    expect(respuesta.body.libre).toEqual([{ horaInicio: '08:00', horaFin: '22:00' }]);
  });

  it('devuelve el dia completamente ocupado cuando la reserva cubre todo el horario', async () => {
    const espacio = await request(entorno.app)
      .post('/api/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        codigo: 'SALA-PEQUENA',
        nombre: 'Sala Pequena',
        tipo: 'SALA_REUNION',
        capacidad: 10,
        horarioApertura: '08:00',
        horarioCierre: '12:00',
      });

    await reservar(espacio.body.id, '2026-03-20', '08:00', '12:00');

    const respuesta = await request(entorno.app)
      .get(`/api/espacios/${espacio.body.id}/disponibilidad?fecha=2026-03-20`)
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.body.libre).toEqual([]);
    expect(respuesta.body.ocupado).toHaveLength(1);
  });

  it('ordena las franjas ocupadas por hora de inicio', async () => {
    await reservar(1, '2026-03-21', '14:00', '15:00');
    await reservar(1, '2026-03-21', '09:00', '10:00');

    const respuesta = await request(entorno.app)
      .get('/api/espacios/LAB-101/disponibilidad?fecha=2026-03-21')
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.body.ocupado[0].horaInicio).toBe('09:00');
    expect(respuesta.body.ocupado[1].horaInicio).toBe('14:00');
  });

  it('responde 404 ESPACIO_NO_ENCONTRADO', async () => {
    const respuesta = await request(entorno.app)
      .get('/api/espacios/NO-EXISTE/disponibilidad?fecha=2026-03-17')
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('ESPACIO_NO_ENCONTRADO');
  });

  it('responde 409 ESPACIO_INACTIVO para un espacio desactivado', async () => {
    const espacio = await request(entorno.app)
      .post('/api/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ codigo: 'SALA-INACTIVA', nombre: 'Sala Inactiva', tipo: 'SALA_REUNION', capacidad: 8 });

    await request(entorno.app)
      .post(`/api/espacios/${espacio.body.id}/desactivar`)
      .set('Authorization', `Bearer ${tokenAdmin}`);

    const respuesta = await request(entorno.app)
      .get(`/api/espacios/${espacio.body.id}/disponibilidad?fecha=2026-03-17`)
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.status).toBe(409);
    expect(respuesta.body.error.codigo).toBe('ESPACIO_INACTIVO');
  });

  it('responde 422 VALIDACION con una fecha mal formada', async () => {
    const respuesta = await request(entorno.app)
      .get('/api/espacios/LAB-101/disponibilidad?fecha=15-01-2026')
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('responde 422 VALIDACION con una fecha que no existe en el calendario', async () => {
    const respuesta = await request(entorno.app)
      .get('/api/espacios/LAB-101/disponibilidad?fecha=2026-02-30')
      .set('Authorization', `Bearer ${tokenDocente}`);

    expect(respuesta.status).toBe(422);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });
});
