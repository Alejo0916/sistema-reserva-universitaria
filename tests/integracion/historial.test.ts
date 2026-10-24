import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearEntornoPrueba, type EntornoPrueba } from '../helpers/entorno.js';
import { iniciarSesion } from '../helpers/sesiones.js';

describe('reservation-history y auditoria - API', () => {
  let entorno: EntornoPrueba;
  let tokenDocente: string;
  let tokenAdmin: string;
  let tokenEstudiante: string;
  let idReserva: number;

  beforeAll(async () => {
    entorno = crearEntornoPrueba();
    tokenDocente = (await iniciarSesion(entorno.app, 'docente@uni.edu', 'docen1234')).token;
    tokenAdmin = (await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234')).token;
    tokenEstudiante = (
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Estudiante Bitacora',
        email: 'bitacora@uni.edu',
        contrasena: 'clave1234',
      })
    ).body.token as string;

    await request(entorno.app)
      .post('/api/espacios')
      .set('Authorization', `Bearer ${tokenAdmin}`)
      .send({ codigo: 'LAB-101', nombre: 'Laboratorio', tipo: 'LABORATORIO', capacidad: 24 });

    const creada = await request(entorno.app)
      .post('/api/reservas')
      .set('Authorization', `Bearer ${tokenDocente}`)
      .send({
        espacioId: 1,
        fecha: '2026-04-01',
        horaInicio: '10:00',
        horaFin: '12:00',
        justificacion: 'Practica de laboratorio de quimica',
      });
    idReserva = creada.body.id as number;
  });

  afterAll(() => {
    entorno.cerrar();
  });

  describe('GET /api/reservas/:id/historial', () => {
    it('devuelve la traza completa y ordenada de una reserva', async () => {
      await request(entorno.app)
        .post(`/api/reservas/${idReserva}/aprobar`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      const respuesta = await request(entorno.app)
        .get(`/api/reservas/${idReserva}/historial`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      const tipos = respuesta.body.datos.map((e: { tipo: string }) => e.tipo);
      expect(tipos).toEqual(['RESERVA_CRIADA', 'RESERVA_APROBADA']);
    });

    it('el solicitante puede consultar el historial de su propia reserva', async () => {
      const respuesta = await request(entorno.app)
        .get(`/api/reservas/${idReserva}/historial`)
        .set('Authorization', `Bearer ${tokenDocente}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.datos.length).toBeGreaterThan(0);
    });

    it('responde 404 RESERVA_NO_ENCONTRADA para una reserva ajena', async () => {
      const respuesta = await request(entorno.app)
        .get(`/api/reservas/${idReserva}/historial`)
        .set('Authorization', `Bearer ${tokenEstudiante}`);

      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('RESERVA_NO_ENCONTRADA');
    });

    it('registra el motivo del rechazo en el evento', async () => {
      const creada = await request(entorno.app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${tokenDocente}`)
        .send({
          espacioId: 1,
          fecha: '2026-04-02',
          horaInicio: '10:00',
          horaFin: '12:00',
          justificacion: 'Practica de laboratorio de quimica',
        });

      await request(entorno.app)
        .post(`/api/reservas/${creada.body.id}/rechazar`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ motivo: 'El laboratorio estara en mantenimiento ese dia' });

      const respuesta = await request(entorno.app)
        .get(`/api/reservas/${creada.body.id}/historial`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      const rechazo = respuesta.body.datos.find((e: { tipo: string }) => e.tipo === 'RESERVA_RECHAZADA');
      expect(rechazo).toBeDefined();
      expect(rechazo.datos.motivo).toBe('El laboratorio estara en mantenimiento ese dia');
      expect(rechazo.actorNombre).toBe('Administrador del Sistema');
    });
  });

  describe('GET /api/eventos', () => {
    it('el administrador consulta la bitacora global', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/eventos')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toHaveProperty('datos');
      expect(respuesta.body).toHaveProperty('total');
      expect(respuesta.body.total).toBeGreaterThan(0);
    });

    it('el coordinador tambien puede consultar la bitacora', async () => {
      const coordinador = await iniciarSesion(entorno.app, 'coordinador@uni.edu', 'coord1234');

      const respuesta = await request(entorno.app)
        .get('/api/eventos')
        .set('Authorization', `Bearer ${coordinador.token}`);

      expect(respuesta.status).toBe(200);
    });

    it('responde 403 PERMISO_DENEGADO para un estudiante', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/eventos')
        .set('Authorization', `Bearer ${tokenEstudiante}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('PERMISO_DENEGADO');
    });

    it('filtra por tipo de evento', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/eventos?tipo=RESERVA_APROBADA')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      for (const evento of respuesta.body.datos) {
        expect(evento.tipo).toBe('RESERVA_APROBADA');
      }
    });

    it('filtra por entidad afectada', async () => {
      const respuesta = await request(entorno.app)
        .get(`/api/eventos?entidadTipo=RESERVA&entidadId=${idReserva}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.datos.length).toBeGreaterThan(0);
      for (const evento of respuesta.body.datos) {
        expect(evento.entidadId).toBe(idReserva);
      }
    });

    it('la bitacora es de solo insercion: los eventos no se modifican', async () => {
      const antes = await request(entorno.app)
        .get(`/api/eventos?entidadTipo=RESERVA&entidadId=${idReserva}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      await request(entorno.app)
        .post(`/api/reservas/${idReserva}/cancelar`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ motivo: 'Cancelacion administrativa de la solicitud' });

      const despues = await request(entorno.app)
        .get(`/api/eventos?entidadTipo=RESERVA&entidadId=${idReserva}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(despues.body.total).toBe(antes.body.total + 1);
      expect(despues.body.datos[0].tipo).toBe('RESERVA_CANCELADA');
    });
  });

  describe('coherencia entre estado e historial', () => {
    it('el detalle y el historial coinciden en el estado final', async () => {
      const detalle = await request(entorno.app)
        .get(`/api/reservas/${idReserva}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      const historial = await request(entorno.app)
        .get(`/api/reservas/${idReserva}/historial`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      const ultimo = historial.body.datos[historial.body.datos.length - 1];
      expect(detalle.body.estado).toBe('CANCELADA');
      expect(ultimo.tipo).toBe('RESERVA_CANCELADA');
    });
  });
});
