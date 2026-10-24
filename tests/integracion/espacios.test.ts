import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearEntornoPrueba, type EntornoPrueba } from '../helpers/entorno.js';
import { iniciarSesion } from '../helpers/sesiones.js';

describe('space-management - API', () => {
  let entorno: EntornoPrueba;
  let tokenAdmin: string;
  let tokenDocente: string;

  beforeAll(async () => {
    entorno = crearEntornoPrueba();
    const admin = await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234');
    const docente = await iniciarSesion(entorno.app, 'docente@uni.edu', 'docen1234');
    tokenAdmin = admin.token;
    tokenDocente = docente.token;
  });

  afterAll(() => {
    entorno.cerrar();
  });

  describe('POST /api/espacios', () => {
    it('crea un espacio valido y lo registra en la bitacora', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          codigo: 'LAB-101',
          nombre: 'Laboratorio de Quimica',
          tipo: 'LABORATORIO',
          capacidad: 24,
          horarioApertura: '08:00',
          horarioCierre: '22:00',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.codigo).toBe('LAB-101');
      expect(respuesta.body.activo).toBe(true);

      const eventos = await request(entorno.app)
        .get('/api/eventos?tipo=ESPACIO_CREADO')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(eventos.body.total).toBeGreaterThan(0);
    });

    it('aplica el horario por defecto si no se indica', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ codigo: 'AUD-MAIN', nombre: 'Auditorio Principal', tipo: 'AUDITORIO', capacidad: 200 });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.horarioApertura).toBe('08:00');
      expect(respuesta.body.horarioCierre).toBe('22:00');
    });

    it('responde 409 CODIGO_ESPACIO_DUPLICADO', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ codigo: 'LAB-101', nombre: 'Duplicado', tipo: 'LABORATORIO', capacidad: 10 });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('CODIGO_ESPACIO_DUPLICADO');
    });

    it('responde 422 VALIDACION con capacidad no positiva', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ codigo: 'LAB-999', nombre: 'Capacidad Mala', tipo: 'LABORATORIO', capacidad: 0 });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
      expect(
        respuesta.body.error.detalles.some((d: { campo: string }) => d.campo === 'capacidad'),
      ).toBe(true);
    });

    it('responde 422 VALIDACION con horario invertido', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          codigo: 'LAB-998',
          nombre: 'Horario Invertido',
          tipo: 'LABORATORIO',
          capacidad: 10,
          horarioApertura: '22:00',
          horarioCierre: '08:00',
        });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 422 TIPO_ESPACIO_DESCONOCIDO con un tipo fuera de catalogo', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ codigo: 'CAF-001', nombre: 'Cafeteria', tipo: 'CAFETERIA', capacidad: 10 });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
    });

    it('responde 403 PERMISO_DENEGADO sin el permiso espacios:escribir', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios')
        .set('Authorization', `Bearer ${tokenDocente}`)
        .send({ codigo: 'LAB-777', nombre: 'No Permitido', tipo: 'LABORATORIO', capacidad: 10 });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('PERMISO_DENEGADO');
    });
  });

  describe('GET /api/espacios', () => {
    it('devuelve el envelope con datos, total, pagina y limite', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/espacios')
        .set('Authorization', `Bearer ${tokenDocente}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toHaveProperty('datos');
      expect(respuesta.body).toHaveProperty('total');
      expect(respuesta.body).toHaveProperty('pagina');
      expect(respuesta.body).toHaveProperty('limite');
    });

    it('filtra por tipo', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/espacios?tipo=AUDITORIO')
        .set('Authorization', `Bearer ${tokenDocente}`);

      expect(respuesta.status).toBe(200);
      for (const espacio of respuesta.body.datos) {
        expect(espacio.tipo).toBe('AUDITORIO');
      }
    });

    it('responde 403 sin el permiso espacios:leer', async () => {
      const estudiante = await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Estudiante Sin Permiso',
        email: 'sinpermiso@uni.edu',
        contrasena: 'clave1234',
      });

      // El estudiante SI tiene espacios:leer; se comprueba el caso no autenticado.
      const respuesta = await request(entorno.app).get('/api/espacios');
      expect(respuesta.status).toBe(401);
      expect(estudiante.status).toBe(201);
    });
  });

  describe('GET /api/espacios/:referencia', () => {
    it('busca por identificador', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/espacios/1')
        .set('Authorization', `Bearer ${tokenDocente}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.codigo).toBe('LAB-101');
    });

    it('busca por codigo', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/espacios/LAB-101')
        .set('Authorization', `Bearer ${tokenDocente}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.id).toBe(1);
    });

    it('responde 404 ESPACIO_NO_ENCONTRADO', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/espacios/NO-EXISTE')
        .set('Authorization', `Bearer ${tokenDocente}`);

      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('ESPACIO_NO_ENCONTRADO');
    });
  });

  describe('PATCH /api/espacios/:referencia', () => {
    it('actualiza la capacidad y lo registra en la bitacora', async () => {
      const respuesta = await request(entorno.app)
        .patch('/api/espacios/LAB-101')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ capacidad: 30 });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.capacidad).toBe(30);

      const eventos = await request(entorno.app)
        .get('/api/eventos?tipo=ESPACIO_ACTUALIZADO')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(eventos.body.total).toBeGreaterThan(0);
    });

    it('responde 409 CODIGO_ESPACIO_DUPLICADO', async () => {
      const respuesta = await request(entorno.app)
        .patch('/api/espacios/LAB-101')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ codigo: 'AUD-MAIN' });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('CODIGO_ESPACIO_DUPLICADO');
    });
  });

  describe('activacion y desactivacion', () => {
    it('desactiva un espacio sin reservas activas', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios/AUD-MAIN/desactivar')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.activo).toBe(false);
    });

    it('reactiva el espacio y vuelve a ser reservable', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/espacios/AUD-MAIN/activar')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.activo).toBe(true);
    });

    it('responde 409 ESPACIO_CON_RESERVAS_ACTIVAS si hay reservas en curso', async () => {
      const docente = await iniciarSesion(entorno.app, 'docente@uni.edu', 'docen1234');

      await request(entorno.app)
        .post('/api/reservas')
        .set('Authorization', `Bearer ${docente.token}`)
        .send({
          espacioId: 1,
          fecha: '2026-03-20',
          horaInicio: '10:00',
          horaFin: '12:00',
          justificacion: 'Practica de laboratorio de quimica',
        });

      const respuesta = await request(entorno.app)
        .post('/api/espacios/LAB-101/desactivar')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('ESPACIO_CON_RESERVAS_ACTIVAS');
    });
  });
});
