import { Router } from 'express';
import { z } from 'zod';
import { PERMISOS } from '../../modules/rbac/domain/catalogo.js';
import { autenticar, autorizar } from '../middlewares/autenticacion.js';
import { controlador } from '../middlewares/errores.js';
import { validar, validarConsulta } from '../middlewares/validacion.js';
import {
  esquemaActualizacionUsuario,
  esquemaRestablecerContrasena,
} from '../../modules/auth/domain/esquemas.js';
import { aUsuarioPublico } from '../../modules/user-management/domain/usuario.js';
import { calcularPaginacion } from '../../shared/coleccion.js';
import type { Contenedor } from '../../container.js';

const esquemaAltaUsuario = z.object({
  nombre: z.string().trim().min(3).max(120),
  email: z.string().trim().toLowerCase().email(),
  contrasena: z.string().min(8),
  rol: z.string().trim().min(1),
  activo: z.boolean().optional(),
});

const esquemaConsultaUsuarios = z.object({
  rol: z.string().trim().optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((valor) => (valor === undefined ? undefined : valor === 'true')),
  texto: z.string().trim().optional(),
  pagina: z.coerce.number().int().positive().optional(),
  limite: z.coerce.number().int().positive().optional(),
});

export function rutasUsuarios(contenedor: Contenedor): Router {
  const router = Router();
  const { auth, usuarios } = contenedor;

  router.get(
    '/',
    autenticar(auth),
    autorizar(PERMISOS.USUARIOS_LEER),
    validarConsulta(esquemaConsultaUsuarios),
    controlador((_req, res) => {
      const consulta = (res.locals['consulta'] ?? {}) as {
        rol?: string;
        activo?: boolean;
        texto?: string;
        pagina?: number;
        limite?: number;
      };
      const paginacion = calcularPaginacion(consulta.pagina, consulta.limite);
      const coleccion = usuarios.listar(
        { rol: consulta.rol, activo: consulta.activo, texto: consulta.texto },
        paginacion,
      );
      res.status(200).json({
        datos: coleccion.datos.map(aUsuarioPublico),
        total: coleccion.total,
        pagina: coleccion.pagina,
        limite: coleccion.limite,
      });
    }),
  );

  router.get(
    '/:id',
    autenticar(auth),
    autorizar(PERMISOS.USUARIOS_LEER),
    controlador((req, res) => {
      const usuario = usuarios.obtener(Number(req.params['id']));
      res.status(200).json(aUsuarioPublico(usuario));
    }),
  );

  router.post(
    '/',
    autenticar(auth),
    autorizar(PERMISOS.USUARIOS_ESCRIBIR),
    validar(esquemaAltaUsuario),
    controlador(async (req, res) => {
      const cuerpo = req.body as {
        nombre: string;
        email: string;
        contrasena: string;
        rol: string;
        activo?: boolean | undefined;
      };
      const usuario = await usuarios.crear(cuerpo);
      res.status(201).json(aUsuarioPublico(usuario));
    }),
  );

  router.patch(
    '/:id',
    autenticar(auth),
    autorizar(PERMISOS.USUARIOS_ESCRIBIR),
    validar(esquemaActualizacionUsuario),
    controlador((req, res) => {
      const cuerpo = req.body as {
        nombre?: string;
        email?: string;
        rol?: string;
        activo?: boolean;
      };
      const actorId = req.usuario?.id ?? 0;
      const usuario = usuarios.actualizar(Number(req.params['id']), cuerpo, actorId);
      res.status(200).json(aUsuarioPublico(usuario));
    }),
  );

  router.post(
    '/:id/desactivar',
    autenticar(auth),
    autorizar(PERMISOS.USUARIOS_ESCRIBIR),
    controlador((req, res) => {
      const actorId = req.usuario?.id ?? 0;
      const usuario = usuarios.desactivar(Number(req.params['id']), actorId);
      res.status(200).json(aUsuarioPublico(usuario));
    }),
  );

  router.post(
    '/:id/contrasena',
    autenticar(auth),
    autorizar(PERMISOS.USUARIOS_ESCRIBIR),
    validar(esquemaRestablecerContrasena),
    controlador(async (req, res) => {
      const cuerpo = req.body as { contrasena: string };
      const actorId = req.usuario?.id ?? 0;
      const usuario = await usuarios.restablecerContrasena(Number(req.params['id']), cuerpo.contrasena, actorId);
      res.status(200).json(aUsuarioPublico(usuario));
    }),
  );

  return router;
}
