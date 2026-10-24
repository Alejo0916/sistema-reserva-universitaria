import { Router } from 'express';
import { z } from 'zod';
import { PERMISOS } from '../../modules/rbac/domain/catalogo.js';
import { autenticar, autorizar } from '../middlewares/autenticacion.js';
import { controlador } from '../middlewares/errores.js';
import { validar, validarConsulta } from '../middlewares/validacion.js';
import {
  esquemaCancelacion,
  esquemaDecision,
  esquemaFiltroReservas,
  esquemaReserva,
} from '../../modules/reservation-management/domain/esquemas.js';
import { calcularPaginacion } from '../../shared/coleccion.js';
import { ERRORES } from '../../domain/errores.js';
import type { Contenedor } from '../../container.js';

const esquemaConsultaReservas = esquemaFiltroReservas.extend({
  pagina: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().positive().optional(),
});

export function rutasReservas(contenedor: Contenedor): Router {
  const router = Router();
  const { auth, reservas } = contenedor;

  router.get(
    '/',
    autenticar(auth),
    autorizar(PERMISOS.RESERVAS_LEER),
    validarConsulta(esquemaConsultaReservas),
    controlador((req, res) => {
      const consulta = (res.locals['consulta'] ?? {}) as {
        espacioId?: number;
        usuarioId?: number;
        estado?: 'PENDIENTE' | 'APROBADA' | 'RECHAZADA' | 'CANCELADA';
        fecha?: string;
        pagina?: number;
        limite?: number;
      };
      const paginacion = calcularPaginacion(consulta.pagina, consulta.limite);

      // Los roles sin visibilidad global solo ven sus propias reservas, con
      // independencia del filtro por solicitante (spec reservation-management,
      // H-09 de la revision).
      const usuario = req.usuario;
      const visibilidadGlobal = usuario?.permisos.has(PERMISOS.RESERVAS_APROBAR) ?? false;
      const criterios = {
        espacioId: consulta.espacioId,
        usuarioId: visibilidadGlobal ? consulta.usuarioId : usuario?.id,
        estado: consulta.estado,
        fecha: consulta.fecha,
      };

      const coleccion = reservas.listar(criterios, paginacion);
      res.status(200).json(coleccion);
    }),
  );

  router.get(
    '/pendientes',
    autenticar(auth),
    autorizar(PERMISOS.RESERVAS_APROBAR),
    validarConsulta(esquemaConsultaReservas),
    controlador((_req, res) => {
      const consulta = (res.locals['consulta'] ?? {}) as {
        espacioId?: number;
        fecha?: string;
        pagina?: number;
        limite?: number;
      };
      const paginacion = calcularPaginacion(consulta.pagina, consulta.limite);
      const coleccion = reservas.listarPendientes(
        { espacioId: consulta.espacioId, fecha: consulta.fecha },
        paginacion,
      );
      res.status(200).json(coleccion);
    }),
  );

  router.get(
    '/:id',
    autenticar(auth),
    autorizar(PERMISOS.RESERVAS_LEER),
    controlador((req, res) => {
      const usuario = req.usuario;
      const reserva = reservas.obtener(Number(req.params['id']));
      const visibilidadGlobal = usuario?.permisos.has(PERMISOS.RESERVAS_APROBAR) ?? false;
      if (!visibilidadGlobal && reserva.usuarioId !== usuario?.id) {
        throw ERRORES.noEncontrado('reserva');
      }
      res.status(200).json(reserva);
    }),
  );

  router.post(
    '/',
    autenticar(auth),
    autorizar(PERMISOS.RESERVAS_CREAR),
    validar(esquemaReserva),
    controlador((req, res) => {
      const cuerpo = req.body as {
        espacioId: number;
        fecha: string;
        horaInicio: string;
        horaFin: string;
        justificacion: string;
        asistentes?: number | null;
      };
      const actorId = req.usuario?.id ?? 0;
      const reserva = reservas.crear(
        {
          espacioId: cuerpo.espacioId,
          fecha: cuerpo.fecha,
          horaInicio: cuerpo.horaInicio,
          horaFin: cuerpo.horaFin,
          justificacion: cuerpo.justificacion,
          asistentes: cuerpo.asistentes ?? null,
        },
        actorId,
      );
      res.status(201).json(reserva);
    }),
  );

  router.post(
    '/:id/cancelar',
    autenticar(auth),
    autorizar(PERMISOS.RESERVAS_CANCELAR),
    validar(esquemaCancelacion),
    controlador((req, res) => {
      const cuerpo = req.body as { motivo?: string };
      const actorId = req.usuario?.id ?? 0;
      const puedeAprobar = req.usuario?.permisos.has(PERMISOS.RESERVAS_APROBAR) ?? false;
      const reserva = reservas.cancelar(Number(req.params['id']), actorId, puedeAprobar, cuerpo.motivo);
      res.status(200).json(reserva);
    }),
  );

  router.post(
    '/:id/aprobar',
    autenticar(auth),
    autorizar(PERMISOS.RESERVAS_APROBAR),
    controlador((req, res) => {
      const actorId = req.usuario?.id ?? 0;
      const reserva = reservas.aprobar(Number(req.params['id']), actorId);
      res.status(200).json(reserva);
    }),
  );

  router.post(
    '/:id/rechazar',
    autenticar(auth),
    autorizar(PERMISOS.RESERVAS_APROBAR),
    validar(esquemaDecision),
    controlador((req, res) => {
      const cuerpo = req.body as { motivo?: string };
      const actorId = req.usuario?.id ?? 0;
      const reserva = reservas.rechazar(Number(req.params['id']), actorId, String(cuerpo.motivo ?? ''));
      res.status(200).json(reserva);
    }),
  );

  return router;
}
