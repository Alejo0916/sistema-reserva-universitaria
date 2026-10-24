import type { Conexion } from './db/conexion.js';
import { RepositorioUsuarios } from './db/repositorios/usuarioRepo.js';
import { RepositorioRoles } from './db/repositorios/rolRepo.js';
import { RepositorioEspacios } from './db/repositorios/espacioRepo.js';
import { RepositorioReservas } from './db/repositorios/reservaRepo.js';
import { RepositorioEventos } from './db/repositorios/eventoRepo.js';
import { crearBusEventos, type BusEventos } from './shared/eventBus.js';
import { relojReal, type Reloj } from './shared/reloj.js';
import type { Config } from './shared/config.js';
import { ServicioAuth } from './modules/auth/application/servicioAuth.js';
import { ServicioUsuarios } from './modules/user-management/application/servicioUsuarios.js';
import { ServicioRbac } from './modules/rbac/application/servicioRbac.js';
import { ServicioEspacios } from './modules/space-management/application/servicioEspacios.js';
import { ServicioDisponibilidad } from './modules/availability/application/servicioDisponibilidad.js';
import { ServicioReservas } from './modules/reservation-management/application/servicioReservas.js';
import { ServicioHistorial } from './modules/reservation-history/application/servicioHistorial.js';
import { crearServicioTokens, type ServicioTokens } from './modules/auth/domain/token.js';
import { LimitadorIntentos } from './modules/auth/domain/limitadorIntentos.js';
import { conectarAuditoria } from './modules/audit/application/conectarAuditoria.js';

export interface Contenedor {
  config: Config;
  conexion: Conexion;
  bus: BusEventos;
  reloj: Reloj;
  repositorios: {
    usuarios: RepositorioUsuarios;
    roles: RepositorioRoles;
    espacios: RepositorioEspacios;
    reservas: RepositorioReservas;
    eventos: RepositorioEventos;
  };
  servicios: {
    auth: ServicioAuth;
    usuarios: ServicioUsuarios;
    rbac: ServicioRbac;
    espacios: ServicioEspacios;
    disponibilidad: ServicioDisponibilidad;
    reservas: ServicioReservas;
    historial: ServicioHistorial;
  };
  tokens: ServicioTokens;
  limitador: LimitadorIntentos;

  // Atajos de acceso a los casos de uso, usados por los routers.
  auth: ServicioAuth;
  usuarios: ServicioUsuarios;
  rbac: ServicioRbac;
  espacios: ServicioEspacios;
  disponibilidad: ServicioDisponibilidad;
  reservas: ServicioReservas;
  historial: ServicioHistorial;
}

export interface OpcionesContenedor {
  config: Config;
  conexion: Conexion;
  reloj?: Reloj;
}

/**
 * Punto unico de composicion: cablea la base de datos, los repositorios, el
 * bus de eventos y los casos de uso (design.md, seccion 3.5).
 */
export function crearContenedor(opciones: OpcionesContenedor): Contenedor {
  const { config, conexion } = opciones;
  const reloj = opciones.reloj ?? relojReal;

  const bus = crearBusEventos();

  const repositorios = {
    usuarios: new RepositorioUsuarios(conexion),
    roles: new RepositorioRoles(conexion),
    espacios: new RepositorioEspacios(conexion),
    reservas: new RepositorioReservas(conexion),
    eventos: new RepositorioEventos(conexion),
  };

  const tokens = crearServicioTokens(config.secretoJwt, config.duracionTokenJwt);
  const limitador = new LimitadorIntentos(reloj);

  const auth = new ServicioAuth({
    usuarios: repositorios.usuarios,
    roles: repositorios.roles,
    tokens,
    limitador,
    bus,
    reloj,
  });

  const usuarios = new ServicioUsuarios({
    usuarios: repositorios.usuarios,
    roles: repositorios.roles,
    bus,
    reloj,
  });

  const rbac = new ServicioRbac(repositorios.roles);

  const espacios = new ServicioEspacios({
    espacios: repositorios.espacios,
    bus,
    reloj,
    horarioAperturaPorDefecto: config.horarioAperturaPorDefecto,
    horarioCierrePorDefecto: config.horarioCierrePorDefecto,
  });

  const disponibilidad = new ServicioDisponibilidad({
    espacios: repositorios.espacios,
    reservas: repositorios.reservas,
  });

  const reservas = new ServicioReservas({
    conexion,
    espacios: repositorios.espacios,
    reservas: repositorios.reservas,
    bus,
    reloj,
    anticipacionMinimaHoras: config.anticipacionMinimaHoras,
    duracionMinimaMinutos: config.duracionMinimaMinutos,
  });

  const historial = new ServicioHistorial({
    eventos: repositorios.eventos,
    reservas: repositorios.reservas,
  });

  conectarAuditoria(bus, repositorios.eventos, reloj);

  const servicios = { auth, usuarios, rbac, espacios, disponibilidad, reservas, historial };

  return {
    config,
    conexion,
    bus,
    reloj,
    repositorios,
    servicios,
    tokens,
    limitador,
    ...servicios,
  };
}
