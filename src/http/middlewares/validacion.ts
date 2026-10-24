import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ErrorDominio } from '../../domain/errores.js';

export interface DetalleValidacion {
  campo: string;
  mensaje: string;
}

function validarConZod(esquema: ZodType, datos: unknown): DetalleValidacion[] {
  const resultado = esquema.safeParse(datos);
  if (resultado.success) {
    return [];
  }
  return resultado.error.issues.map((issue) => ({
    campo: issue.path.join('.') === '' ? 'cuerpo' : issue.path.join('.'),
    mensaje: issue.message,
  }));
}

/**
 * Middleware de validacion de entrada.
 *
 * Ademas de validar, ANOTA el resultado en `req.body` ya tipado, de modo que
 * los controladores trabajen con datos validados y no con `unknown`.
 */
export function validar(esquema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const detalles = validarConZod(esquema, req.body);
    if (detalles.length > 0) {
      next(
        new ErrorDominio('VALIDACION', 'Los datos enviados no son validos', 422, {
          detalles,
        }),
      );
      return;
    }
    const resultado = esquema.safeParse(req.body);
    if (resultado.success) {
      req.body = resultado.data;
    }
    next();
  };
}

/** Middleware de validacion de parametros de consulta. */
export function validarConsulta(esquema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const detalles = validarConZod(esquema, req.query);
    if (detalles.length > 0) {
      next(
        new ErrorDominio('VALIDACION', 'Los parametros de consulta no son validos', 422, {
          detalles,
        }),
      );
      return;
    }
    const resultado = esquema.safeParse(req.query);
    if (resultado.success) {
      res.locals['consulta'] = resultado.data;
    }
    next();
  };
}

export { ZodError };
