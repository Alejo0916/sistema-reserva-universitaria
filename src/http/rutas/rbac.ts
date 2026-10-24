import { Router } from 'express';
import { autenticar } from '../middlewares/autenticacion.js';
import { controlador } from '../middlewares/errores.js';
import type { Contenedor } from '../../container.js';

export function rutasRbac(contenedor: Contenedor): Router {
  const router = Router();
  const { auth, rbac } = contenedor;

  router.get(
    '/roles',
    autenticar(auth),
    controlador((_req, res) => {
      res.status(200).json({ datos: rbac.listarRoles() });
    }),
  );

  router.get(
    '/permisos',
    autenticar(auth),
    controlador((_req, res) => {
      res.status(200).json({ datos: rbac.listarPermisos() });
    }),
  );

  return router;
}
