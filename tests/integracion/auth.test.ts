import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearEntornoPrueba, type EntornoPrueba } from '../helpers/entorno.js';
import { iniciarSesion } from '../helpers/sesiones.js';

describe('auth - API', () => {
  let entorno: EntornoPrueba;

  beforeAll(() => {
    entorno = crearEntornoPrueba();
  });

  afterAll(() => {
    entorno.cerrar();
  });

  describe('POST /api/auth/registro', () => {
    it('registra un usuario valido con rol ESTUDIANTE y devuelve token', async () => {
      const respuesta = await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Ana Torres',
        email: 'ana@uni.edu',
        contrasena: 'clave1234',
      });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.usuario.rol).toBe('ESTUDIANTE');
      expect(respuesta.body.usuario.activo).toBe(true);
      expect(typeof respuesta.body.token).toBe('string');
      expect(respuesta.body.usuario.passwordHash).toBeUndefined();
      expect(respuesta.body.usuario.contrasena).toBeUndefined();
    });

    it('rechaza la autoasignacion de un rol privilegiado', async () => {
      const respuesta = await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Intruso Malicioso',
        email: 'intruso@uni.edu',
        contrasena: 'clave1234',
        rol: 'ADMIN',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('ROL_NO_PERMITIDO');
    });

    it('rechaza un correo ya registrado con 409 EMAIL_DUPLICADO', async () => {
      const respuesta = await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Ana Torres',
        email: 'ana@uni.edu',
        contrasena: 'clave1234',
      });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('EMAIL_DUPLICADO');
    });

    it('rechaza una contrasena insegura con 422 VALIDACION', async () => {
      const respuesta = await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Contrasena Debil',
        email: 'debil@uni.edu',
        contrasena: 'corta',
      });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('VALIDACION');
      expect(respuesta.body.error.detalles.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/login', () => {
    it('devuelve token y usuario con credenciales validas', async () => {
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Luis Paz',
        email: 'luis@uni.edu',
        contrasena: 'clave1234',
      });

      const respuesta = await request(entorno.app)
        .post('/api/auth/login')
        .send({ email: 'luis@uni.edu', contrasena: 'clave1234' });

      expect(respuesta.status).toBe(200);
      expect(typeof respuesta.body.token).toBe('string');
      expect(respuesta.body.usuario.email).toBe('luis@uni.edu');
      expect(respuesta.body.usuario.passwordHash).toBeUndefined();
    });

    it('responde 401 CREDENCIALES_INVALIDAS con contrasena incorrecta', async () => {
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Luis Paz',
        email: 'luis@uni.edu',
        contrasena: 'clave1234',
      });

      const respuesta = await request(entorno.app)
        .post('/api/auth/login')
        .send({ email: 'luis@uni.edu', contrasena: 'incorrecta1234' });

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    });

    it('responde 401 si el usuario esta desactivado', async () => {
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Temporal',
        email: 'temporal@uni.edu',
        contrasena: 'clave1234',
      });

      const admin = await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234');
      const listado = await request(entorno.app)
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${admin.token}`);
      const temporal = listado.body.datos.find(
        (u: { email: string }) => u.email === 'temporal@uni.edu',
      );

      await request(entorno.app)
        .post(`/api/usuarios/${temporal.id}/desactivar`)
        .set('Authorization', `Bearer ${admin.token}`);

      const respuesta = await request(entorno.app)
        .post('/api/auth/login')
        .send({ email: 'temporal@uni.edu', contrasena: 'clave1234' });

      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe('CREDENCIALES_INVALIDAS');
    });

    it('registra el intento fallido en la bitacora', async () => {
      await request(entorno.app)
        .post('/api/auth/login')
        .send({ email: 'intento-fallido@uni.edu', contrasena: 'mala12345' });

      const admin = await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234');
      const respuesta = await request(entorno.app)
        .get('/api/eventos?tipo=LOGIN_FALLIDO')
        .set('Authorization', `Bearer ${admin.token}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.total).toBeGreaterThan(0);
    });

    it('bloquea el correo tras 5 intentos fallidos con 429', async () => {
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Objetivo',
        email: 'objetivo@uni.edu',
        contrasena: 'clave1234',
      });

      for (let intento = 0; intento < 5; intento += 1) {
        await request(entorno.app)
          .post('/api/auth/login')
          .send({ email: 'objetivo@uni.edu', contrasena: 'mala12345' });
      }

      const respuesta = await request(entorno.app)
        .post('/api/auth/login')
        .send({ email: 'objetivo@uni.edu', contrasena: 'clave1234' });

      expect(respuesta.status).toBe(429);
      expect(respuesta.body.error.codigo).toBe('DEMASIADOS_INTENTOS');
    });
  });

  describe('GET /api/auth/perfil', () => {
    it('devuelve el perfil propio', async () => {
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Perfil Prueba',
        email: 'perfil@uni.edu',
        contrasena: 'clave1234',
      });
      const sesion = await iniciarSesion(entorno.app, 'perfil@uni.edu');

      const respuesta = await request(entorno.app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${sesion.token}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.email).toBe('perfil@uni.edu');
      expect(respuesta.body.rol).toBe('ESTUDIANTE');
      expect(respuesta.body.contrasena).toBeUndefined();
      expect(respuesta.body.passwordHash).toBeUndefined();
    });

    it('responde 401 sin token', async () => {
      const respuesta = await request(entorno.app).get('/api/auth/perfil');
      expect(respuesta.status).toBe(401);
      expect(respuesta.body.error.codigo).toBe('NO_AUTENTICADO');
    });
  });

  describe('POST /api/auth/logout', () => {
    it('invalida el token emitido antes del cierre de sesion', async () => {
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Cierra Sesion',
        email: 'cierra@uni.edu',
        contrasena: 'clave1234',
      });
      const sesion = await iniciarSesion(entorno.app, 'cierra@uni.edu');

      const cierre = await request(entorno.app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${sesion.token}`);
      expect(cierre.status).toBe(204);

      const reutilizado = await request(entorno.app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${sesion.token}`);
      expect(reutilizado.status).toBe(401);
      expect(reutilizado.body.error.codigo).toBe('NO_AUTENTICADO');
    });

    it('permite iniciar sesion de nuevo tras el cierre', async () => {
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Reabre Sesion',
        email: 'reabre@uni.edu',
        contrasena: 'clave1234',
      });
      const sesion = await iniciarSesion(entorno.app, 'reabre@uni.edu');

      await request(entorno.app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${sesion.token}`);

      const nuevo = await iniciarSesion(entorno.app, 'reabre@uni.edu');
      expect(nuevo.token).toBeDefined();
    });
  });

  describe('el token no transporta el rol', () => {
    it('solo contiene el identificador y la version de token', async () => {
      await request(entorno.app).post('/api/auth/registro').send({
        nombre: 'Token Plano',
        email: 'token@uni.edu',
        contrasena: 'clave1234',
      });
      const sesion = await iniciarSesion(entorno.app, 'token@uni.edu');

      const [, contenido] = sesion.token.split('.');
      const decodificado = JSON.parse(Buffer.from(contenido as string, 'base64url').toString('utf-8'));

      expect(decodificado.sub).toBe(sesion.id);
      expect(typeof decodificado.tv).toBe('number');
      expect(decodificado.rol).toBeUndefined();
      expect(decodificado.permisos).toBeUndefined();
    });
  });

  describe('GET /api/health', () => {
    it('responde 200 con el estado de la base de datos', async () => {
      const respuesta = await request(entorno.app).get('/api/health');
      expect(respuesta.status).toBe(200);
      expect(respuesta.body.estado).toBe('ok');
      expect(respuesta.body.baseDatos).toBe('ok');
    });
  });
});
