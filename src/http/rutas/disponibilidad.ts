import { Router } from 'express';
import { z } from 'zod';
import { PERMISOS } from '../../modules/rbac/domain/catalogo.js';
import { autenticar, autorizar } from '../middlewares/autenticacion.js';
import { controlador } from '../middlewares/errores.js';
import { validarConsulta } from '../middlewares/validacion.js';
import { RE_FECHA } from '../../modules/reservation-management/domain/esquemas.js';
import type { Contenedor } from '../../container.js';

const esquemaConsultaDisponibilidad = z.object({
  fecha: z.string().regex(RE_FECHA, 'La fecha debe tener el formato YYYY-MM-DD'),
});

export function rutasDisponibilidad(contenedor: Contenedor): Router {
  const router = Router();
  const { auth, disponibilidad } = contenedor;

  router.get(
    '/:referencia/disponibilidad',
    autenticar(auth),
    autorizar(PERMISOS.ESPACIOS_LEER),
    validarConsulta(esquemaConsultaDisponibilidad),
    controlador((req, res) => {
      const consulta = (res.locals['consulta'] ?? {}) as { fecha?: string };
      const resultado = disponibilidad.consultar(String(req.params['referencia']), String(consulta.fecha ?? ''));
      res.status(200).json(resultado);
    }),
  );

  return router;
}
