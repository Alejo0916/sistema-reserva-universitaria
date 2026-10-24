import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearEntornoPrueba, type EntornoPrueba } from '../helpers/entorno.js';
import { iniciarSesion } from '../helpers/sesiones.js';

describe('reservation-management - API', () => {
  let entorno: EntornoPrueba;
  let tokenDocente: string;
  let tokenAdmin: string;
  let tokenCoordinador: string;
  let tokenEstudiante: string;

  beforeAll(async () => {
    entorno = crearEntornoPrueba();
    tokenDocente = (await iniciarSesion(entorno.app, 'docente@uni.edu', 'docen1234')).token;
    tokenAdmin = (await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234')).token;
    tokenCoordinador = (await iniciarSesion(entorno.app, 'coordinador@uni.edu', 'coord1234')).token;

    const estudiante = await request(entorno.app).post('/api/auth/registro').send({
      nombre: 'Estudiante Uno',
      email: 'estudiante1@uni.edu',
      contrasena: 'clave1234',
    });
    tokenEstudiante = estudiante.body.token as string;

    await request(entorno.app)
      .post('/api/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({
        codigo: 'LAB-101',
        nombre: 'Laboratorio de Prueba',
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
        nombre: 'Auditorio de Prueba',
        tipo: 'AUDITORIO',
        capacidad: 200,
        horarioApertura: '08:00',
        horarioCierre: '22:00',
      });
  });

  afterAll(() => {
    entorno.cerrar();
  });

  async function crearReserva(
    token: string,
    cuerpo: Record<string, unknown>,
  ): Promise<request.Response> {
    return request(entorno.app).post('/api/reservas').set('Authorization', `Bearer ${token}`).send(cuerpo);
  }

  describe('POST /api/reservas - creacion valida', () => {
    it('crea la reserva en estado PENDIENTE y registra el evento', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-20',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.estado).toBe('PENDIENTE');
      expect(respuesta.body.solicitanteNombre).toBe('Docente de Prueba');
      expect(respuesta.body.espacioCodigo).toBe('LAB-101');

      const eventos = await request(entorno.app)
        .get('/api/eventos?tipo=RESERVA_CRIADA')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(eventos.body.total).toBeGreaterThan(0);
    });

    it('acepta el campo opcional asistentes', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-21',
        horaInicio: '14:00',
        horaFin: '15:00',
        justificacion: 'Sesion de tutoria con grupo de estudiantes',
        asistentes: 20,
      });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.asistentes).toBe(20);
    });

    it('responde 401 NO_AUTENTICADO sin token', async () => {
      const respuesta = await request(entorno.app).post('/api/reservas').send({
        espacioId: 1,
        fecha: '2026-03-20',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
    });

    it('responde 422 VALIDACION si falta la justificacion', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-20',
        horaInicio: '10:00',
        horaFin: '12:00',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    });
  });

  describe('POST /api/reservas - validaciones de la franja', () => {
    it('responde 422 VALIDACION si la hora de fin no es posterior a la de inicio', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-20',
        horaInicio: '12:00',
        horaFin: '10:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 422 VALIDACION si la duracion es inferior al minimo', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-20',
        horaInicio: '10:00',
        horaFin: '10:10',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 422 VALIDACION si la fecha esta en el pasado', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-10',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
      expect(
        respuesta.body.error.detalles.some((d: { campo: string }) => d.campo === 'fecha'),
      ).toBe(true);
    });

    it('responde 422 ANTICIPACION_INSUFICIENTE si no hay margen de anticipacion', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-16',
        horaInicio: '09:00',
        horaFin: '10:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('ANTICIPACION_INSUFICIENTE');
    });

    it('responde 422 FUERA_DE_HORARIO si la reserva no cabe en el horario del espacio', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-22',
        horaInicio: '07:00',
        horaFin: '09:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('FUERA_DE_HORARIO');
    });

    it('responde 404 ESPACIO_NO_ENCONTRADO si el espacio no existe', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 9999,
        fecha: '2026-03-22',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('ESPACIO_NO_ENCONTRADO');
    });

    it('responde 409 ESPACIO_INACTIVO si el espacio esta desactivado', async () => {
      await request(entorno.app)
        .post('/api/espacios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ codigo: 'SALA-OFF', nombre: 'Sala Apagada', tipo: 'SALA_REUNION', capacidad: 8 });

      const espacio = await request(entorno.app)
        .get('/api/espacios/SALA-OFF')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      await request(entorno.app)
        .post(`/api/espacios/${espacio.body.id}/desactivar`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: espacio.body.id,
        fecha: '2026-03-22',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESPACIO_INACTIVO');
    });

    it('responde 422 CAPACIDAD_EXCEDIDA si los asistentes superan la capacidad', async () => {
      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-03-23',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
        asistentes: 30,
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('CAPACIDAD_EXCEDIDA');
    });
  });

  describe('POST /api/reservas - prevencion de reservas simultaneas', () => {
    it('responde 409 ESPACIO_OCUPADO ante un solapamiento total', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-01',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-01',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Otra practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESPACIO_OCUPADO');
    });

    it('responde 409 ESPACIO_OCUPADO ante un solapamiento parcial', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-02',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-02',
        horaInicio: '11:30',
        horaFin: '13:00',
        justificacion: 'Otra practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESPACIO_OCUPADO');
    });

    it('responde 409 ESPACIO_OCUPADO si la nueva franja esta contenida en otra', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-03',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-03',
        horaInicio: '10:30',
        horaFin: '11:00',
        justificacion: 'Otra practica de laboratorio de quimica',
      });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESPACIO_OCUPADO');
    });

    it('permite franjas contiguas que solo se tocan en un extremo', async () => {
      const primera = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-04',
        horaInicio: '10:00',
        horaFin: '11:00',
        justificacion: 'Practica de laboratorio de quimica',
      });
      expect(primera.status).toBe(201);

      const segunda = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-04',
        horaInicio: '11:00',
        horaFin: '12:00',
        justificacion: 'Segunda sesion de laboratorio de quimica',
      });
      expect(segunda.status).toBe(201);
    });

    it('permite la misma franja en otro espacio', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-05',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await crearReserva(tokenDocente, {
        espacioId: 2,
        fecha: '2026-04-05',
        horaInicio: '11:00',
        horaFin: '13:00',
        justificacion: 'Conferencia en el auditorio principal',
      });

      expect(respuesta.status).toBe(201);
    });

    it('no persiste la reserva rechazada por solapamiento', async () => {
      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-06',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const listadoAntes = await request(entorno.app)
        .get('/api/reservas?fecha=2026-04-06')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-06',
        horaInicio: '11:00',
        horaFin: '13:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const listadoDespues = await request(entorno.app)
        .get('/api/reservas?fecha=2026-04-06')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(listadoDespues.body.total).toBe(listadoAntes.body.total);
    });

    it('solo una de dos solicitudes concurrentes sobre la misma franja prospera', async () => {
      const [primera, segunda] = await Promise.all([
        crearReserva(tokenDocente, {
          espacioId: 1,
          fecha: '2026-04-07',
          horaInicio: '10:00',
          horaFin: '12:00',
          justificacion: 'Solicitud concurrente numero uno',
        }),
        crearReserva(tokenEstudiante, {
          espacioId: 1,
          fecha: '2026-04-07',
          horaInicio: '10:00',
          horaFin: '12:00',
          justificacion: 'Solicitud concurrente numero dos',
        }),
      ]);

      const estados = [primera.status, segunda.status].sort();
      expect(estados).toEqual([201, 409]);
      expect([primera, segunda].find((r) => r.status === 409)?.body.error.codigo).toBe('ESPACIO_OCUPADO');

      const listado = await request(entorno.app)
        .get('/api/reservas?fecha=2026-04-07')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(listado.body.total).toBe(1);
    });
  });

  describe('GET /api/reservas', () => {
    it('el estudiante solo ve sus propias reservas', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenEstudiante}`);

      expect(respuesta.status).toBe(200);
      for (const reserva of respuesta.body.datos) {
        expect(reserva.solicitanteEmail).toBe('estudiante1@uni.edu');
      }
    });

    it('el filtro por solicitante no amplía el alcance del estudiante', async () => {
      const todos = await request(entorno.app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      const respuesta = await request(entorno.app)
        .get('/api/reservas?usuarioId=1')
        .set('Authorization', `Bearer ${tokenEstudiante}`);

      expect(respuesta.status).toBe(200);
      for (const reserva of respuesta.body.datos) {
        expect(reserva.solicitanteEmail).toBe('estudiante1@uni.edu');
      }
      expect(todos.body.total).toBeGreaterThanOrEqual(respuesta.body.total);
    });

    it('el administrador ve todas las reservas', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.total).toBeGreaterThan(1);
    });

    it('filtra por estado y por fecha', async () => {
      const porEstado = await request(entorno.app)
        .get('/api/reservas?estado=PENDIENTE')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      for (const reserva of porEstado.body.datos) {
        expect(reserva.estado).toBe('PENDIENTE');
      }

      const porFecha = await request(entorno.app)
        .get('/api/reservas?fecha=2026-04-01')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      for (const reserva of porFecha.body.datos) {
        expect(reserva.fecha).toBe('2026-04-01');
      }
    });

    it('devuelve el envelope con datos, total, pagina y limite', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/reservas')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.body).toHaveProperty('datos');
      expect(respuesta.body).toHaveProperty('total');
      expect(respuesta.body).toHaveProperty('pagina');
      expect(respuesta.body).toHaveProperty('limite');
      expect(respuesta.body.total).toBeGreaterThanOrEqual(respuesta.body.datos.length);
    });
  });

  describe('GET /api/reservas/:id', () => {
    it('devuelve el detalle de una reserva propia', async () => {
      const creada = await crearReserva(tokenEstudiante, {
        espacioId: 2,
        fecha: '2026-04-08',
        horaInicio: '16:00',
        horaFin: '17:00',
        justificacion: 'Estudio grupal en el auditorio principal',
      });

      const respuesta = await request(entorno.app)
        .get(`/api/reservas/${creada.body.id}`)
        .set('Authorization', `Bearer ${tokenEstudiante}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.id).toBe(creada.body.id);
    });

    it('responde 404 RESERVA_NO_ENCONTRADA para una reserva ajena no visible', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 2,
        fecha: '2026-04-09',
        horaInicio: '16:00',
        horaFin: '17:00',
        justificacion: 'Reunion de departamento en el auditorio',
      });

      const respuesta = await request(entorno.app)
        .get(`/api/reservas/${creada.body.id}`)
        .set('Authorization', `Bearer ${tokenEstudiante}`);

      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('RESERVA_NO_ENCONTRADA');
    });
  });

  describe('POST /api/reservas/:id/cancelar', () => {
    it('permite cancelar una reserva propia y registra el motivo', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 2,
        fecha: '2026-04-10',
        horaInicio: '16:00',
        horaFin: '17:00',
        justificacion: 'Reunion de departamento en el auditorio',
      });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/cancelar`)
        .set('Authorization', `Bearer ${tokenDocente}`)
        .send({ motivo: 'Se reprogramo la reunion de departamento' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.estado).toBe('CANCELADA');
      expect(respuesta.body.motivo).toBe('Se reprogramo la reunion de departamento');

      const eventos = await request(entorno.app)
        .get(`/api/reservas/${creada.body.id}/historial`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(eventos.body.datos.some((e: { tipo: string }) => e.tipo === 'RESERVA_CANCELADA')).toBe(true);
    });

    it('responde 409 ESTADO_INVALIDO al cancelar una reserva ya cancelada', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 2,
        fecha: '2026-04-11',
        horaInicio: '16:00',
        horaFin: '17:00',
        justificacion: 'Reunion de departamento en el auditorio',
      });

      await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/cancelar`)
        .set('Authorization', `Bearer ${tokenDocente}`)
        .send({ motivo: 'Se reprogramo la reunion de departamento' });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/cancelar`)
        .set('Authorization', `Bearer ${tokenDocente}`)
        .send({ motivo: 'Segundo intento de cancelacion' });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESTADO_INVALIDO');
    });

    it('responde 409 ESTADO_INVALIDO al cancelar una reserva rechazada', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 2,
        fecha: '2026-04-12',
        horaInicio: '16:00',
        horaFin: '17:00',
        justificacion: 'Reunion de departamento en el auditorio',
      });

      await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/rechazar`)
        .set('Authorization', `Bearer ${tokenCoordinador}`)
        .send({ motivo: 'El auditorio estara en mantenimiento ese dia' });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/cancelar`)
        .set('Authorization', `Bearer ${tokenDocente}`)
        .send({ motivo: 'Intento de cancelar una reserva ya rechazada' });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESTADO_INVALIDO');
    });

    it('responde 403 PERMISO_DENEGADO si un tercero intenta cancelar', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 2,
        fecha: '2026-04-13',
        horaInicio: '16:00',
        horaFin: '17:00',
        justificacion: 'Reunion de departamento en el auditorio',
      });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/cancelar`)
        .set('Authorization', `Bearer ${tokenEstudiante}`)
        .send({ motivo: 'Intento de cancelacion de un tercero' });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('PERMISO_DENEGADO');
    });

    it('la franja liberada vuelve a estar disponible', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-14',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/cancelar`)
        .set('Authorization', `Bearer ${tokenDocente}`)
        .send({ motivo: 'Se reprogramo la practica de laboratorio' });

      const nueva = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-14',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio reprogramada',
      });

      expect(nueva.status).toBe(201);
    });
  });

  describe('POST /api/reservas/:id/aprobar y /rechazar', () => {
    it('el coordinador aprueba una solicitud pendiente', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-15',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/aprobar`)
        .set('Authorization', `Bearer ${tokenCoordinador}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.estado).toBe('APROBADA');
      expect(respuesta.body.revisorNombre).toBe('Coordinadora Academica');

      const eventos = await request(entorno.app)
        .get(`/api/reservas/${creada.body.id}/historial`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      const tipos = eventos.body.datos.map((e: { tipo: string }) => e.tipo);
      expect(tipos).toContain('RESERVA_CRIADA');
      expect(tipos).toContain('RESERVA_APROBADA');
    });

    it('responde 403 PERMISO_DENEGADO si un estudiante intenta aprobar', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-16',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/aprobar`)
        .set('Authorization', `Bearer ${tokenEstudiante}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('PERMISO_DENEGADO');
    });

    it('responde 403 AUTO_APROBACION_PROHIBIDA si el solicitante intenta aprobar su reserva', async () => {
      const creada = await crearReserva(tokenCoordinador, {
        espacioId: 1,
        fecha: '2026-04-17',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Reunion de coordinacion dearea academica',
      });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/aprobar`)
        .set('Authorization', `Bearer ${tokenCoordinador}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('AUTO_APROBACION_PROHIBIDA');
    });

    it('responde 409 ESTADO_INVALIDO al aprobar una reserva ya aprobada', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-18',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/aprobar`)
        .set('Authorization', `Bearer ${tokenCoordinador}`);

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/aprobar`)
        .set('Authorization', `Bearer ${tokenCoordinador}`);

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESTADO_INVALIDO');
    });

    it('rechaza con el motivo obligatorio y registra el motivo', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-19',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/rechazar`)
        .set('Authorization', `Bearer ${tokenCoordinador}`)
        .send({ motivo: 'El laboratorio estara en mantenimiento ese dia' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.estado).toBe('RECHAZADA');
      expect(respuesta.body.motivo).toBe('El laboratorio estara en mantenimiento ese dia');
    });

    it('responde 422 VALIDACION al rechazar sin motivo', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-20',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      const respuesta = await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/rechazar`)
        .set('Authorization', `Bearer ${tokenCoordinador}`)
        .send({});

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');

      const estado = await request(entorno.app)
        .get(`/api/reservas/${creada.body.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(estado.body.estado).toBe('PENDIENTE');
    });

    it('la franja de una reserva rechazada puede reutilizarse', async () => {
      const creada = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-21',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });

      await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/rechazar`)
        .set('Authorization', `Bearer ${tokenCoordinador}`)
        .send({ motivo: 'El laboratorio estara en mantenimiento ese dia' });

      const nueva = await crearReserva(tokenDocente, {
        espacioId: 1,
        fecha: '2026-04-21',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica reprogramada',
      });

      expect(nueva.status).toBe(201);
    });
  });

  describe('GET /api/reservas/pendientes', () => {
    it('devuelve la cola de solicitudes pendientes para el coordinador', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/reservas/pendientes')
        .set('Authorization', `Bearer ${tokenCoordinador}`);

      expect(respuesta.status).toBe(200);
      for (const reserva of respuesta.body.datos) {
        expect(reserva.estado).toBe('PENDIENTE');
      }
    });

    it('responde 403 PERMISO_DENEGADO para el docente', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/reservas/pendientes')
        .set('Authorization', `Bearer ${tokenDocente}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('PERMISO_DENEGADO');
    });
  });
});
