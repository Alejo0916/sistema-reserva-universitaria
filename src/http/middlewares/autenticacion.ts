import type { NextFunction, Request, Response } from 'express';
import { ERRORES } from '../../domain/errores.js';
import type { ServicioAuth } from '../../modules/auth/application/servicioAuth.js';
import type { UsuarioAutenticado } from '../../modules/rbac/domain/tipos.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado;
    }
  }
}

/**
 * Middleware de autenticacion.
 *
 * El token debe enviarse en la cabecera `Authorization: Bearer <token>`.
 * El rol y los permisos se resuelven desde la base de datos en cada peticion
 * (spec auth y rbac, H-02 de la revision).
 */
export function autenticar(servicioAuth: ServicioAuth) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const cabecera = req.header('authorization');
    if (cabecera === undefined || !cabecera.toLowerCase().startsWith('bearer ')) {
      next(ERRORES.noAutenticado());
      return;
    }

    const token = cabecera.slice(7).trim();
    if (token === '') {
      next(ERRORES.noAutenticado());
      return;
    }

    void servicioAuth
      .resolverIdentidad(token)
      .then((usuario) => {
        if (usuario === null) {
          next(ERRORES.noAutenticado());
          return;
        }
        req.usuario = usuario;
        next();
      })
      .catch(() => {
        next(ERRORES.noAutenticado());
      });
  };
}

/** Middleware de autorizacion por permiso. */
export function autorizar(permiso: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const usuario = req.usuario;
    if (usuario === undefined) {
      next(ERRORES.noAutenticado());
      return;
    }
    if (!usuario.permisos.has(permiso)) {
      next(ERRORES.permisoDenegado(permiso));
      return;
    }
    next();
  };
}
