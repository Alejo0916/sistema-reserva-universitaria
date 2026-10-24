import express, { type Express } from 'express';
import cors from 'cors';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { verificarIntegridad } from './db/conexion.js';
import { manejadorErrores } from './http/middlewares/errores.js';
import { rutasAuth } from './http/rutas/auth.js';
import { rutasUsuarios } from './http/rutas/usuarios.js';
import { rutasRbac } from './http/rutas/rbac.js';
import { rutasEspacios } from './http/rutas/espacios.js';
import { rutasDisponibilidad } from './http/rutas/disponibilidad.js';
import { rutasReservas } from './http/rutas/reservas.js';
import { rutasHistorial } from './http/rutas/historial.js';
import type { Contenedor } from './container.js';

const directorioRaiz = join(dirname(fileURLToPath(import.meta.url)), '..');

export function crearAplicacion(contenedor: Contenedor): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(cors({ origin: contenedor.config.origenCors, credentials: true }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    const integridad = verificarIntegridad(contenedor.conexion);
    res.status(integridad ? 200 : 503).json({
      estado: integridad ? 'ok' : 'degradado',
      baseDatos: integridad ? 'ok' : 'error de integridad',
      version: '1.0.0',
    });
  });

  app.use('/api/auth', rutasAuth(contenedor));
  app.use('/api/usuarios', rutasUsuarios(contenedor));
  app.use('/api', rutasRbac(contenedor));
  app.use('/api/espacios', rutasEspacios(contenedor));
  app.use('/api/espacios', rutasDisponibilidad(contenedor));
  app.use('/api/reservas', rutasReservas(contenedor));
  app.use('/api', rutasHistorial(contenedor));

  app.use(express.static(join(directorioRaiz, 'public')));

  app.use((_req, res) => {
    res.status(404).json({
      error: { codigo: 'RUTA_NO_ENCONTRADA', mensaje: 'El recurso solicitado no existe', detalles: [] },
    });
  });

  app.use(manejadorErrores(contenedor.config.esProduccion));

  return app;
}
