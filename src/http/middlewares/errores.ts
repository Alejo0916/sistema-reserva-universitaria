import type { NextFunction, Request, Response } from 'express';
import { ErrorDominio } from '../../domain/errores.js';

export interface FormatoError {
  error: {
    codigo: string;
    mensaje: string;
    detalles: { campo?: string; mensaje: string }[];
  };
}

/**
 * Manejador centralizado de errores.
 *
 * Traduce cualquier error a la envoltura unica de la API
 * `{ error: { codigo, mensaje, detalles } }` (design.md, decision D7).
 * En produccion nunca se expone la traza de la pila.
 */
export function manejadorErrores(esProduccion: boolean) {
  return (error: unknown, _req: Request, res: Response, next: NextFunction): void => {
    if (res.headersSent) {
      next(error);
      return;
    }

    if (error instanceof ErrorDominio) {
      const cuerpo: FormatoError = {
        error: {
          codigo: error.codigo,
          mensaje: error.message,
          detalles: error.detalles,
        },
      };
      res.status(error.estado).json(cuerpo);
      return;
    }

    if (error instanceof Error && 'type' in error && error.type === 'entity.parse.failed') {
      const cuerpo: FormatoError = {
        error: {
          codigo: 'VALIDACION',
          mensaje: 'El cuerpo de la peticion no es JSON valido',
          detalles: [],
        },
      };
      res.status(400).json(cuerpo);
      return;
    }

    const mensaje =
      error instanceof Error ? error.message : 'Se ha producido un error inesperado en el servidor';

    if (!esProduccion && error instanceof Error && error.stack !== undefined) {
      res.status(500).json({
        error: {
          codigo: 'ERROR_INTERNO',
          mensaje,
          detalles: [{ mensaje: error.stack }],
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        codigo: 'ERROR_INTERNO',
        mensaje: 'Se ha producido un error inesperado en el servidor',
        detalles: [],
      },
    });
  };
}

/** Envoltura para controladores asincronos. */
export function controlador(
  fn: (req: Request, res: Response) => Promise<void> | void,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    try {
      const resultado = fn(req, res);
      if (resultado instanceof Promise) {
        resultado.catch(next);
      }
    } catch (error) {
      next(error);
    }
  };
}
