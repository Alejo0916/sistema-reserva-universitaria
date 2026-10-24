import { Router } from 'express';
import { z } from 'zod';
import { PERMISOS } from '../../modules/rbac/domain/catalogo.js';
import { autenticar, autorizar } from '../middlewares/autenticacion.js';
import { controlador } from '../middlewares/errores.js';
import { validar, validarConsulta } from '../middlewares/validacion.js';
import { esquemaActualizacionEspacio, esquemaEspacio } from '../../modules/space-management/domain/esquemas.js';
import { calcularPaginacion } from '../../shared/coleccion.js';
import type { Contenedor } from '../../container.js';

const esquemaConsultaEspacios = z.object({
  tipo: z.string().trim().optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => (valor === undefined ? undefined : valor === 'true')),
  pagina: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().positive().optional(),
});

export function rutasEspacios(contenedor: Contenedor): Router {
  const router = Router();
  const { auth, espacios } = contenedor;

  router.get(
    '/',
    autenticar(auth),
    autorizar(PERMISOS.ESPACIOS_LEER),
    validarConsulta(esquemaConsultaEspacios),
    controlador((_req, res) => {
      const consulta = (res.locals['consulta'] ?? {}) as {
        tipo?: string;
        activo?: boolean;
        pagina?: number;
        limite?: number;
      };
      const paginacion = calcularPaginacion(consulta.pagina, consulta.limite);
      const coleccion = espacios.listar({ tipo: consulta.tipo, activo: consulta.activo }, paginacion);
      res.status(200).json(coleccion);
    }),
  );

  router.get(
    '/:referencia',
    autenticar(auth),
    autorizar(PERMISOS.ESPACIOS_LEER),
    controlador((req, res) => {
      const espacio = espacios.obtener(String(req.params['referencia']));
      res.status(200).json(espacio);
    }),
  );

  router.post(
    '/',
    autenticar(auth),
    autorizar(PERMISOS.ESPACIOS_ESCRIBIR),
    validar(esquemaEspacio),
    controlador((req, res) => {
      const cuerpo = req.body as {
        codigo: string;
        nombre: string;
        tipo: string;
        descripcion?: string | null;
        capacidad: number;
        edificio?: string | null;
        piso?: string | null;
        horarioApertura?: string;
        horarioCierre?: string;
        activo?: boolean;
      };
      const espacio = espacios.crear(cuerpo);
      res.status(201).json(espacio);
    }),
  );

  router.patch(
    '/:referencia',
    autenticar(auth),
    autorizar(PERMISOS.ESPACIOS_ESCRIBIR),
    validar(esquemaActualizacionEspacio),
    controlador((req, res) => {
      const cuerpo = req.body as {
        codigo?: string;
        nombre?: string;
        tipo?: string;
        descripcion?: string | null;
        capacidad?: number;
        edificio?: string | null;
        piso?: string | null;
        horarioApertura?: string;
        horarioCierre?: string;
        activo?: boolean;
      };
      const actorId = req.usuario?.id ?? 0;
      const espacio = espacios.actualizar(String(req.params['referencia']), cuerpo, actorId);
      res.status(200).json(espacio);
    }),
  );

  router.post(
    '/:referencia/desactivar',
    autenticar(auth),
    autorizar(PERMISOS.ESPACIOS_ESCRIBIR),
    controlador((req, res) => {
      const actorId = req.usuario?.id ?? 0;
      const espacio = espacios.desactivar(String(req.params['referencia']), actorId);
      res.status(200).json(espacio);
    }),
  );

  router.post(
    '/:referencia/activar',
    autenticar(auth),
    autorizar(PERMISOS.ESPACIOS_ESCRIBIR),
    controlador((req, res) => {
      const actorId = req.usuario?.id ?? 0;
      const espacio = espacios.activar(String(req.params['referencia']), actorId);
      res.status(200).json(espacio);
    }),
  );

  return router;
}
