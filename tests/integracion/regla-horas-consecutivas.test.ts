import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearEntornoPrueba, type EntornoPrueba } from '../helpers/entorno.js';
import { iniciarSesion } from '../helpers/sesiones.js';

/**
 * Change `limit-4-horas-consecutivas`.
 *
 * Regla de negocio: ningun usuario podra reservar un espacio academico
 * durante mas de cuatro horas consecutivas.
 */
describe('regla de 4 horas consecutivas - API', () => {
  let entorno: EntornoPrueba;
  let tokenDocente: string;
  let tokenEstudiante: string;
  let tokenAdmin: string;

  beforeAll(async () => {
    entorno = crearEntornoPrueba();
    tokenDocente = (await iniciarSesion(entorno.app, 'docente@uni.edu', 'docen1234')).token;
    tokenAdmin = (await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234')).token;
    tokenEstudiante = (
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Estudiante Regla',
        email: 'regla@uni.edu',
        contrasena: 'clave1234',
      })
    ).body.token as string;

    await request(entorno.app)
      .post('/api/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        codigo: 'LAB-101',
        nombre: 'Laboratorio',
        tipo: 'LABORATORIO',
        capacidad: 24,
        horarioApertura: '08:00',
        horarioCierre: '22:00',
      });

    await request(entorno.app)
      .post('/api/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        codigo: 'AUD-MAIN',
        nombre: 'Auditorio',
        tipo: 'AUDITORIO',
        capacidad: 200,
        horarioApertura: '08:00',
        horarioCierre: '22:00',
      });
  });

  afterAll(() => {
    entorno.cerrar();
  });

  async function crearReserva(token: string, cuerpo: Record<string, unknown>): Promise<request.Response> {
    return request(entorno.app).post('/api/reservas').set('Authorization', `Bearer ${token}`).send(cuerpo);
  }

  describe('limite de duracion por reserva', () => {
    it('acepta una reserva de exactamente cuatro horas', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-04',
        horaInicio: '09:00',
        horaFin: '13:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.horaInicio).toBe('09:00');
      expect(respuesta.body.horaFin).toBe('13:00');
    });

    it('rechaza una reserva de mas de cuatro horas con DURACION_EXCEDIDA', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-05',
        horaInicio: '09:00',
        horaFin: '13:01',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('DURACION_EXCEDIDA');
      expect(respuesta.body.error.detalles.length).toBeGreaterThan(0);
      expect(respuesta.body.error.detalles[0].mensaje).toContain('241');
      expect(respuesta.body.error.detalles[0].mensaje).toContain('240');
    });

    it('no persiste la reserva rechazada por duracion', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-06',
        horaInicio: '09:00',
        horaFin: '13:01',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const listado = await request(entorno.app)
        .get('/api/reservas?fecha=2026-05-06')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(listado.body.total).toBe(0);
    });

    it('rechaza una reserva de ocho horas aunque quepa en el horario del espacio', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-07',
        horaInicio: '08:00',
        horaFin: '16:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('DURACION_EXCEDIDA');
    });

    it('aplica el limite con independencia del espacio', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 2,
        fecha: '2026-05-08',
        horaInicio: '10:00',
        horaFin: '15:00',
        justificacion: 'Conferencia en el auditorio principal',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('DURACION_EXCEDIDA');
    });

    it('la fecha en el pasado prevalece sobre el exceso de duracion', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-10',
        horaInicio: '08:00',
        horaFin: '16:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    });
  });

  describe('limite de horas consecutivas del usuario', () => {
    it('acepta dos reservas contiguas que suman exactamente cuatro horas', async () => {
      const primera = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-11',
        horaInicio: '09:00',
        horaFin: '11:00',
        justificacion: 'Practica de laboratorio de quimica',
      });
      expect(primera.status).toBe(201);

      const segunda = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-11',
        horaInicio: '11:00',
        horaFin: '13:00',
        justificacion: 'Segunda sesion de laboratorio de quimica',
      });
      expect(segunda.status).toBe(201);
    });

    it('rechaza dos reservas contiguas que suman mas de cuatro horas', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-12',
        horaInicio: '09:00',
        horaFin: '11:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-12',
        horaInicio: '11:00',
        horaFin: '14:00',
        justificacion: 'Segunda sesion de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('HORAS_CONSECUTIVAS_EXCEDIDAS');
      expect(respuesta.body.error.detalles[0].mensaje).toContain('09:00');
      expect(respuesta.body.error.detalles[0].mensaje).toContain('14:00');
    });

    it('no persiste la reserva rechazada por horas consecutivas', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-13',
        horaInicio: '09:00',
        horaFin: '11:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-13',
        horaInicio: '11:00',
        horaFin: '14:00',
        justificacion: 'Segunda sesion de laboratorio de quimica',
      });

      const listado = await request(entorno.app)
        .get('/api/reservas?fecha=2026-05-13')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(listado.body.total).toBe(1);
    });

    it('admite reservas separadas por un hueco: el total no se acumula', async () => {
      const primera = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-14',
        horaInicio: '08:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });
      expect(primera.status).toBe(201);

      const segunda = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-14',
        horaInicio: '13:00',
        horaFin: '15:00',
        justificacion: 'Sesion de tutoria posterior al almuerzo',
      });
      expect(segunda.status).toBe(201);
    });

    it('el computo abarca reservas en espacios distintos', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-15',
        horaInicio: '09:00',
        horaFin: '11:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 2,
        fecha: '2026-05-15',
        horaInicio: '11:00',
        horaFin: '14:00',
        justificacion: 'Conferencia en el auditorio principal',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('HORAS_CONSECUTIVAS_EXCEDIDAS');
    });

    it('ignora las reservas en estado terminal', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-16',
        horaInicio: '09:00',
        horaFin: '13:00',
        justificacion: 'Practica de laboratorio de quimica',
      });
      expect(creada.status).toBe(201);

      await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/cancelar`)
        .set('Authorization', `Bearer ${tokenDocente}`)
        .send({ motivo: 'Se reprogramo la practica de laboratorio' });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-16',
        horaInicio: '13:00',
        horaFin: '15:00',
        justificacion: 'Sesion de tutoria posterior al almuerzo',
      });

      expect(respuesta.status).toBe(201);
    });

    it('ignora las reservas de otras personas', async () => {
      await crearReserva(tokenEstudiante, {
        espacioId: 1,
        fecha: '2026-05-17',
        horaInicio: '11:00',
        horaFin: '15:00',
        justificacion: 'Estudio grupal en el laboratorio',
      });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-17',
        horaInicio: '09:00',
        horaFin: '13:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESPACIO_OCUPADO');
      expect(respuesta.body.error.codigo).not.toBe('HORAS_CONSECUTIVAS_EXCEDIDAS');
    });

    it('el computo se limita a la fecha de la nueva reserva', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-18',
        horaInicio: '09:00',
        horaFin: '13:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-19',
        horaInicio: '09:00',
        horaFin: '11:00',
        justificacion: 'Practica de laboratorio del dia siguiente',
      });

      expect(respuesta.status).toBe(201);
    });

    it('como maximo prospera una de dos solicitudes concurrentes sobre franjas contiguas', async () => {
      const [primera, segunda] = await Promise.all([
        crearReserva(tokenDocente, {
          espacioId: 2,
          fecha: '2026-05-20',
          horaInicio: '09:00',
          horaFin: '11:00',
          justificacion: 'Solicitud concurrente numero uno',
        }),
        crearReserva(tokenDocente, {
          espacioId: 2,
          fecha: '2026-05-20',
          horaInicio: '11:00',
          horaFin: '14:00',
          justificacion: 'Solicitud concurrente numero dos',
        }),
      ]);

      const estados = [primera.status, segunda.status].sort();
      expect(estados).toEqual([201, 422]);
      expect([primera, segunda].find((r) => r.status === 422)?.body.error.codigo).toBe(
        'HORAS_CONSECUTIVAS_EXCEDIDAS',
      );

      const listado = await request(entorno.app)
        .get('/api/reservas?fecha=2026-05-20')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(listado.body.total).toBe(1);
    });
  });

  describe('no regresion de las funcionalidades existentes', () => {
    it('una reserva de duracion normal sigue siendo valida', async () => {
      const respuesta = await crearReserva(tokenEstudiante, {
        espacioId: 2,
        fecha: '2026-05-21',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Estudio grupal en el auditorio',
      });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.estado).toBe('PENDIENTE');
    });

    it('el flujo de aprobacion sigue funcionando con la regla activa', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-22',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const aprobacion = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/aprobar`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(aprobacion.status).toBe(200);
      expect(aprobacion.body.estado).toBe('APROBADA');
    });

    it('el flujo de rechazo con motivo sigue funcionando', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-23',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const rechazo = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/rechazar`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ motivo: 'El laboratorio estara en mantenimiento ese dia' });

      expect(rechazo.status).toBe(200);
      expect(rechazo.body.estado).toBe('RECHAZADA');
    });

    it('la bitacora registra el rechazo por la regla nueva', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-24',
        horaInicio: '09:00',
        horaFin: '13:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const rechazo = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-05-24',
        horaInicio: '13:00',
        horaFin: '15:00',
        justificacion: 'Sesion de tutoria posterior al almuerzo',
      });
      expect(rechazo.status).toBe(422);

      const listado = await request(entorno.app)
        .get('/api/reservas?fecha=2026-05-24')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(listado.body.total).toBe(1);
    });
  });
});
