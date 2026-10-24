import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { crearEntornoPrueba, type EntornoPrueba } from '../helpers/entorno.js';
import { iniciarSesion } from '../helpers/sesiones.js';

describe('user-management y rbac - API', () => {
  let entorno: EntornoPrueba;
  let tokenAdmin: string;

  beforeAll(async () => {
    entorno = crearEntornoPrueba();
    const admin = await iniciarSesion(entorno.app, 'admin@uni.edu', 'admin1234');
    tokenAdmin = admin.token;
  });

  afterAll(() => {
    entorno.cerrar();
  });

  describe('POST /api/usuarios', () => {
    it('crea un usuario con el rol indicado', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nombre: 'Sara Ruiz',
          email: 'sara@uni.edu',
          contrasena: 'clave1234',
          rol: 'COORDINADOR',
        });

      expect(respuesta.status).toBe(201);
      expect(respuesta.body.rol).toBe('COORDINADOR');
      expect(respuesta.body.email).toBe('sara@uni.edu');
      expect(respuesta.body.passwordHash).toBeUndefined();
    });

    it('responde 409 EMAIL_DUPLICADO con un correo ya existente', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nombre: 'Sara Otra',
          email: 'sara@uni.edu',
          contrasena: 'clave1234',
          rol: 'DOCENTE',
        });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('EMAIL_DUPLICADO');
    });

    it('responde 422 ROL_DESCONOCIDO con un rol inexistente', async () => {
      const respuesta = await request(entorno.app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nombre: 'Rol Inventado',
          email: 'rolinventado@uni.edu',
          contrasena: 'clave1234',
          rol: 'SUPERADMIN',
        });

      expect(respuesta.status).toBe(422);
      expect(respuesta.body.error.codigo).toBe('ROL_DESCONOCIDO');
    });

    it('responde 403 PERMISO_DENEGADO sin el permiso usuarios:escribir', async () => {
      const docente = await iniciarSesion(entorno.app, 'docente@uni.edu', 'docen1234');

      const respuesta = await request(entorno.app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${docente.token}`)
        .send({
          nombre: 'No Permitido',
          email: 'nopermitido@uni.edu',
          contrasena: 'clave1234',
          rol: 'ADMIN',
        });

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('PERMISO_DENEGADO');
    });
  });

  describe('GET /api/usuarios', () => {
    it('devuelve el envelope con datos, total, pagina y limite', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body).toHaveProperty('datos');
      expect(respuesta.body).toHaveProperty('total');
      expect(respuesta.body).toHaveProperty('pagina');
      expect(respuesta.body).toHaveProperty('limite');
      expect(Array.isArray(respuesta.body.datos)).toBe(true);
    });

    it('filtra por rol', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/usuarios?rol=DOCENTE')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.datos.length).toBeGreaterThan(0);
      for (const usuario of respuesta.body.datos) {
        expect(usuario.rol).toBe('DOCENTE');
      }
    });

    it('busca por texto libre en nombre o correo', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/usuarios?texto=admin')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.datos.length).toBeGreaterThan(0);
    });

    it('responde 403 sin el permiso usuarios:leer', async () => {
      const docente = await iniciarSesion(entorno.app, 'docente@uni.edu', 'docen1234');

      const respuesta = await request(entorno.app)
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${docente.token}`);

      expect(respuesta.status).toBe(403);
      expect(respuesta.body.error.codigo).toBe('PERMISO_DENEGADO');
    });
  });

  describe('GET /api/usuarios/:id', () => {
    it('devuelve el usuario existente', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/usuarios/1')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.email).toBe('admin@uni.edu');
    });

    it('responde 404 USUARIO_NO_ENCONTRADO con un identificador inexistente', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/usuarios/99999')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(404);
      expect(respuesta.body.error.codigo).toBe('USUARIO_NO_ENCONTRADO');
    });
  });

  describe('PATCH /api/usuarios/:id', () => {
    it('cambia el rol y lo deja registrado en la bitacora', async () => {
      const creado = await request(entorno.app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nombre: 'Cambio De Rol',
          email: 'cambiorol@uni.edu',
          contrasena: 'clave1234',
          rol: 'ESTUDIANTE',
        });

      const respuesta = await request(entorno.app)
        .patch(`/api/usuarios/${creado.body.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ rol: 'DOCENTE' });

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.rol).toBe('DOCENTE');

      const eventos = await request(entorno.app)
        .get(`/api/eventos?entidadTipo=USUARIO&entidadId=${creado.body.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`);
      expect(eventos.body.datos.some((e: { tipo: string }) => e.tipo === 'USUARIO_ACTUALIZADO')).toBe(true);
    });

    it('responde 409 EMAIL_DUPLICADO si el correo ya pertenece a otro usuario', async () => {
      const respuesta = await request(entorno.app)
        .patch('/api/usuarios/2')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ email: 'admin@uni.edu' });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('EMAIL_DUPLICADO');
    });

    it('impide que el administrador se quite su propio rol', async () => {
      const respuesta = await request(entorno.app)
        .patch('/api/usuarios/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ rol: 'DOCENTE' });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('AUTOMODIFICACION_PROHIBIDA');
    });

    it('impide que el administrador se desactive a si mismo', async () => {
      const respuesta = await request(entorno.app)
        .patch('/api/usuarios/1')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ activo: false });

      expect(respuesta.status).toBe(409);
      expect(respuesta.body.error.codigo).toBe('AUTOMODIFICACION_PROHIBIDA');
    });
  });

  describe('POST /api/usuarios/:id/desactivar', () => {
    it('desactiva el usuario e invalida sus tokens', async () => {
      const creado = await request(entorno.app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nombre: 'A Desactivar',
          email: 'adesactivar@uni.edu',
          contrasena: 'clave1234',
          rol: 'DOCENTE',
        });

      const sesion = await iniciarSesion(entorno.app, 'adesactivar@uni.edu');

      const desactivacion = await request(entorno.app)
        .post(`/api/usuarios/${creado.body.id}/desactivar`)
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(desactivacion.status).toBe(200);
      expect(desactivacion.body.activo).toBe(false);

      const reutilizado = await request(entorno.app)
        .get('/api/auth/perfil')
        .set('Authorization', `Bearer ${sesion.token}`);
      expect(reutilizado.status).toBe(401);
    });
  });

  describe('POST /api/usuarios/:id/contrasena', () => {
    it('restablece la contrasena y permite iniciar sesion con la nueva', async () => {
      const creado = await request(entorno.app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nombre: 'Contrasena',
          email: 'contrasena@uni.edu',
          contrasena: 'clave1234',
          rol: 'DOCENTE',
        });

      const respuesta = await request(entorno.app)
        .post(`/api/usuarios/${creado.body.id}/contrasena`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ contrasena: 'nueva1234' });

      expect(respuesta.status).toBe(200);

      const nuevo = await iniciarSesion(entorno.app, 'contrasena@uni.edu', 'nueva1234');
      expect(nuevo.token).toBeDefined();

      const antiguo = await request(entorno.app)
        .post('/api/auth/login')
        .send({ email: 'contrasena@uni.edu', contrasena: 'clave1234' });
      expect(antiguo.status).toBe(401);
    });
  });

  describe('GET /api/roles y GET /api/permisos', () => {
    it('expone los cuatro roles con sus permisos', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/roles')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      expect(respuesta.body.datos).toHaveLength(4);

      const admin = respuesta.body.datos.find((r: { nombre: string }) => r.nombre === 'ADMIN');
      const estudiante = respuesta.body.datos.find((r: { nombre: string }) => r.nombre === 'ESTUDIANTE');
      const coordinador = respuesta.body.datos.find((r: { nombre: string }) => r.nombre === 'COORDINADOR');

      expect(admin.permisos).toHaveLength(10);
      expect(estudiante.permisos).not.toContain('reservas:aprobar');
      expect(estudiante.permisos).not.toContain('usuarios:leer');
      expect(coordinador.permisos).toContain('reservas:aprobar');
      expect(coordinador.permisos).not.toContain('usuarios:escribir');
    });

    it('expone el catalogo de permisos', async () => {
      const respuesta = await request(entorno.app)
        .get('/api/permisos')
        .set('Authorization', `Bearer ${tokenAdmin}`);

      expect(respuesta.status).toBe(200);
      const claves = respuesta.body.datos.map((p: { clave: string }) => p.clave);
      for (const clave of [
        'espacios:leer',
        'espacios:escribir',
        'reservas:crear',
        'reservas:leer',
        'reservas:cancelar',
        'reservas:aprobar',
        'usuarios:leer',
        'usuarios:escribir',
        'roles:leer',
        'auditoria:leer',
      ]) {
        expect(claves).toContain(clave);
      }
    });

    it('responde 401 sin autenticacion', async () => {
      const respuesta = await request(entorno.app).get('/api/roles');
      expect(respuesta.status).toBe(401);
    });
  });

  describe('el permiso se evalua con el rol vigente', () => {
    it('aplica el cambio de rol de inmediato sobre un token ya emitido', async () => {
      const creado = await request(entorno.app)
        .post('/api/usuarios')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          nombre: 'Promovido',
          email: 'promovido@uni.edu',
          contrasena: 'clave1234',
          rol: 'ESTUDIANTE',
        });

      const sesion = await iniciarSesion(entorno.app, 'promovido@uni.edu');

      const antes = await request(entorno.app)
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${sesion.token}`);
      expect(antes.status).toBe(403);

      await request(entorno.app)
        .patch(`/api/usuarios/${creado.body.id}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ rol: 'COORDINADOR' });

      const despues = await request(entorno.app)
        .get('/api/usuarios')
        .set('Authorization', `Bearer ${sesion.token}`);
      expect(despues.status).toBe(200);
    });
  });
});
