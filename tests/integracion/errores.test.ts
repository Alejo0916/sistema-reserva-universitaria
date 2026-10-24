import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearEntornoPrueba, type EntornoPrueba } from '../helpers/entorno.js';
import { iniciarSesion } from '../helpers/sesiones.js';

describe('manejo de errores HTTP', () => {
  let entorno: EntornoPrueba;
  let token: string;

  beforeAll(async () => {
    entorno = crearEntornoPrueba();
    token = (await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234')).token;
  });

  afterAll(() => {
    entorno.cerrar();
  });

  it('responde 404 con un codigo estable cuando la ruta no existe', async () => {
    const respuesta = await request(entorno.app).get('/api/no-existe');

    expect(respuesta.status).toBe(404);
    expect(respuesta.body.error.codigo).toBe('RUTA_NO_ENCONTRADA');
    expect(respuesta.body.error.mensaje).toBeDefined();
    expect(Array.isArray(respuesta.body.error.detalles)).toBe(true);
  });

  it('responde 400 cuando el cuerpo no es JSON valido', async () => {
    const respuesta = await request(entorno.app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{ esto no es json');

    expect(respuesta.status).toBe(400);
    expect(respuesta.body.error.codigo).toBe('VALIDACION');
  });

  it('responde 401 cuando la cabecera Authorization no tiene el esquema Bearer', async () => {
    const respuesta = await request(entorno.app)
      .get('/api/auth/perfil')
      .set('Authorization', 'token-invalido');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('responde 401 cuando el token es una cadena vacia', async () => {
    const respuesta = await request(entorno.app)
      .get('/api/auth/perfil')
      .set('Authorization', 'Bearer   ');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('responde 401 cuando el token esta corrupto', async () => {
    const respuesta = await request(entorno.app)
      .get('/api/auth/perfil')
      .set('Authorization', 'Bearer eyJhbGciOiJIUzI1NiJ9. Basura. Firma');

    expect(respuesta.status).toBe(401);
    expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
  });

  it('todas las respuestas de error usan la misma envoltura', async () => {
    const respuestas = await Promise.all([
      request(entorno.app).get('/api/no-existe'),
      request(entorno.app).get('/api/auth/perfil'),
      request(entorno.app).get('/api/usuarios/99999').set('Authorization', `Bearer ${token}`),
    ]);

    for (const respuesta of respuestas) {
      expect(respuesta.body).toHaveProperty('error');
      expect(respuesta.body.error).toHaveProperty('codigo');
      expect(respuesta.body.error).toHaveProperty('mensaje');
      expect(respuesta.body.error).toHaveProperty('detalles');
    }
  });

  it('el detalle de validacion identifica el campo incorrecto', async () => {
    const respuesta = await request(entorno.app)
      .post('/api/auth/registro')
      .send({ nombre: 'A', email: 'no-es-un-correo', contrasena: '123' });

    expect(respuesta.status).toBe(422);
    const campos = respuesta.body.error.detalles.map((d: { campo: string }) => d.campo);
    expect(campos).toContain('nombre');
    expect(campos).toContain('email');
    expect(campos).toContain('contrasena');
  });
});
