import { Router } from 'express';
import { z } from 'zod';
import { PERMISOS } from '../../modules/rbac/domain/catalogo.js';
import { autenticar, autorizar } from '../middlewares/autenticacion.js';
import { controlador } from '../middlewares/errores.js';
import { validarConsulta } from '../middlewares/validacion.js';
import { calcularPaginacion } from '../../shared/coleccion.js';
import type { Contenedor } from '../../container.js';

const esquemaConsultaEventos = z.object({
  tipo: z.string().trim().optional(),
  entidadTipo: z.string().trim().optional(),
  entidadId: z.coerce.number().int().positive().optional(),
  desde: z.string().trim().optional(),
  hasta: z.string().trim().optional(),
  pagina: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().positive().optional(),
});

export function rutasHistorial(contenedor: Contenedor): Router {
  const router = Router();
  const { auth, historial, reservas } = contenedor;

  router.get(
    '/reservas/:id/historial',
    autenticar(auth),
    autorizar(PERMISOS.RESERVAS_LEER),
    controlador((req, res) => {
      const usuario = req.usuario;
      const reserva = reservas.obtener(Number(req.params['id']));
      const visibilidadGlobal = usuario?.permisos.has(PERMISOS.RESERVAS_APROBAR) ?? false;
      if (!visibilidadGlobal && reserva.usuarioId !== usuario?.id) {
        res.status(404).json({
          error: { codigo: 'RESERVA_NO_ENCONTRADA', mensaje: 'Reserva no encontrada', detalles: [] },
        });
        return;
      }
      res.status(200).json({ datos: historial.historialDeReserva(reserva.id) });
    }),
  );

  router.get(
    '/eventos',
    autenticar(auth),
    autorizar(PERMISOS.AUDITORIA_LEER),
    validarConsulta(esquemaConsultaEventos),
    controlador((_req, res) => {
      const consulta = (res.locals['consulta'] ?? {}) as {
        tipo?: string;
        entidadTipo?: string;
        entidadId?: number;
        desde?: string;
        hasta?: string;
        pagina?: number;
        limite?: number;
      };
      const paginacion = calcularPaginacion(consulta.pagina, consulta.limite);
      const coleccion = historial.listarEventos(
        {
          tipo: consulta.tipo,
          entidadTipo: consulta.entidadTipo,
          entidadId: consulta.entidadId,
          desde: consulta.desde,
          hasta: consulta.hasta,
        },
        paginacion,
      );
      res.status(200).json(coleccion);
    }),
  );

  return router;
}
