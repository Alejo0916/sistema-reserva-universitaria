import { Router } from 'express';
import { autenticar } from '../middlewares/autenticacion.js';
import { controlador } from '../middlewares/errores.js';
import { validar } from '../middlewares/validacion.js';
import { esquemaLogin, esquemaRegistro } from '../../modules/auth/domain/esquemas.js';
import { aUsuarioPublico } from '../../modules/user-management/domain/usuario.js';
import type { Contenedor } from '../../container.js';

export function rutasAuth(contenedor: Contenedor): Router {
  const router = Router();
  const { auth } = contenedor;

  router.post(
    '/registro',
    validar(esquemaRegistro),
    controlador(async (req, res) => {
      const cuerpo = req.body as {
        nombre: string;
        email: string;
        contrasena: string;
        rol?: string | undefined;
      };
      const resultado = await auth.registrar(cuerpo);
      res.status(201).json({
        token: resultado.token,
        usuario: aUsuarioPublico(resultado.usuario),
      });
    }),
  );

  router.post(
    '/login',
    validar(esquemaLogin),
    controlador(async (req, res) => {
      const cuerpo = req.body as { email: string; contrasena: string };
      const resultado = await auth.iniciarSesion(cuerpo);
      res.status(200).json({
        token: resultado.token,
        usuario: aUsuarioPublico(resultado.usuario),
      });
    }),
  );

  router.get(
    '/perfil',
    autenticar(auth),
    controlador((req, res) => {
      const usuario = req.usuario;
      res.status(200).json({
        id: usuario?.id,
        nombre: usuario?.nombre,
        email: usuario?.email,
        rol: usuario?.rol,
        activo: true,
      });
    }),
  );

  router.post(
    '/logout',
    autenticar(auth),
    controlador((req, res) => {
      const usuario = req.usuario;
      if (usuario !== undefined) {
        auth.cerrarSesion(usuario.id);
      }
      res.status(204).send();
    }),
  );

  return router;
}
