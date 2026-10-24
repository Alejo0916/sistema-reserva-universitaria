import type { Conexion } from '../../../db/conexion.js';
import { enTransaccion } from '../../../db/transaccion.js';
import type { RepositorioEspacios } from '../../../db/repositorios/espacioRepo.js';
import type { RepositorioReservas } from '../../../db/repositorios/reservaRepo.js';
import type { Reloj } from '../../../shared/reloj.js';
import type { BusEventos } from '../../../shared/eventBus.js';
import type { Coleccion, ParametrosPaginacion } from '../../../shared/coleccion.js';
import { ERRORES } from '../../../domain/errores.js';
import { aMinutos, esFechaPasada, esFechaValida, fechaCivil, marcaTiempo, minutosEntre } from '../../../domain/tiempo.js';
import { transicionValida, type EstadoReserva } from '../../../domain/tipos.js';
import type { Espacio } from '../../space-management/domain/espacio.js';
import type { CriteriosReserva, ReservaDetallada } from '../domain/reserva.js';

export interface DependenciasReservas {
  conexion: Conexion;
  espacios: RepositorioEspacios;
  reservas: RepositorioReservas;
  bus: BusEventos;
  reloj: Reloj;
  anticipacionMinimaHoras: number;
  duracionMinimaMinutos: number;
}

export interface SolicitudCrearReserva {
  espacioId: number;
  fecha: string;
  horaInicio: string;
  horaFin: string;
  justificacion: string;
  asistentes: number | null;
}

export class ServicioReservas {
  constructor(private readonly deps: DependenciasReservas) {}

  /**
   * Crea una solicitud de reserva.
   *
   * El orden de validacion es el fijado por la especificacion (H-05 de la
   * revision): espacio -> coherencia de franja y fecha -> anticipacion ->
   * encaje en el horario del espacio -> asistentes -> disponibilidad.
   *
   * La verificacion de disponibilidad y la insercion se ejecutan dentro de
   * una misma transaccion `IMMEDIATE`: son inseparables.
   */
  crear(datos: SolicitudCrearReserva, actorId: number): ReservaDetallada {
    // 1. El espacio debe existir y estar activo.
    const espacio = this.deps.espacios.buscarPorId(datos.espacioId);
    if (espacio === null) {
      throw ERRORES.noEncontrado('espacio');
    }
    if (!espacio.activo) {
      throw ERRORES.espacioInactivo();
    }

    // 2. Coherencia de la franja y de la fecha.
    this.validarCoherencia(datos);

    // 3. Anticipacion minima respecto al inicio de la reserva.
    this.validarAnticipacion(datos);

    // 4. Encaje dentro del horario de funcionamiento del espacio.
    this.validarHorario(espacio, datos);

    // 5. Numero de asistentes frente a la capacidad del espacio.
    this.validarCapacidad(espacio, datos);

    // 6. Disponibilidad: verificacion e insercion en la misma transaccion.
    const ahora = marcaTiempo(this.deps.reloj.ahora());

    return enTransaccion(this.deps.conexion, () => {
      const solapadas = this.deps.reservas.buscarSolapadas(
        espacio.id,
        datos.fecha,
        datos.horaInicio,
        datos.horaFin,
      );
      if (solapadas.length > 0) {
        const conflicto = solapadas[0];
        if (conflicto !== undefined) {
          throw ERRORES.espacioOcupado([
            {
              campo: 'horaInicio',
              mensaje: `La franja ${conflicto.horaInicio} a ${conflicto.horaFin} ya esta reservada (${conflicto.estado})`,
            },
          ]);
        }
      }

      const reserva = this.deps.reservas.crear({
        espacioId: espacio.id,
        usuarioId: actorId,
        fecha: datos.fecha,
        horaInicio: datos.horaInicio,
        horaFin: datos.horaFin,
        justificacion: datos.justificacion,
        asistentes: datos.asistentes,
        ahora,
      });

      this.deps.bus.emitir({
        tipo: 'RESERVA_CRIADA',
        actorId,
        entidadTipo: 'RESERVA',
        entidadId: reserva.id,
        datos: {
          espacioId: espacio.id,
          espacioCodigo: espacio.codigo,
          fecha: reserva.fecha,
          horaInicio: reserva.horaInicio,
          horaFin: reserva.horaFin,
          estado: reserva.estado,
          asistentes: reserva.asistentes,
        },
      });

      return reserva;
    });
  }

  listar(criterios: CriteriosReserva, paginacion: ParametrosPaginacion): Coleccion<ReservaDetallada> {
    const resultado = this.deps.reservas.listar(criterios, paginacion.pagina, paginacion.limite);
    return { datos: resultado.datos, total: resultado.total, ...paginacion };
  }

  obtener(id: number): ReservaDetallada {
    const reserva = this.deps.reservas.buscarPorId(id);
    if (reserva === null) {
      throw ERRORES.noEncontrado('reserva');
    }
    return reserva;
  }

  /**
   * Cancela una reserva en estado PENDIENTE o APROBADA.
   * Solo el solicitante o quien tenga el permiso `reservas:aprobar`.
   */
  cancelar(id: number, actorId: number, actorTienePermisoAprobar: boolean, motivo?: string): ReservaDetallada {
    const reserva = this.deps.reservas.buscarPorId(id);
    if (reserva === null) {
      throw ERRORES.noEncontrado('reserva');
    }
    if (reserva.usuarioId !== actorId && !actorTienePermisoAprobar) {
      throw ERRORES.permisoDenegado('reservas:cancelar');
    }
    if (!transicionValida(reserva.estado, 'CANCELADA')) {
      throw ERRORES.estadoInvalido(`Una reserva en estado ${reserva.estado} no se puede cancelar`);
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    const actualizada = this.deps.reservas.actualizarEstado(
      id,
      'CANCELADA',
      { motivo: motivo ?? null, revisorId: actorId },
      ahora,
    );

    this.deps.bus.emitir({
      tipo: 'RESERVA_CANCELADA',
      actorId,
      entidadTipo: 'RESERVA',
      entidadId: id,
      datos: { motivo: motivo ?? null, estadoAnterior: reserva.estado },
    });

    if (actualizada === null) {
      throw ERRORES.noEncontrado('reserva');
    }
    return actualizada;
  }

  /** Aprobar una solicitud pendiente. */
  aprobar(id: number, actorId: number): ReservaDetallada {
    const reserva = this.deps.reservas.buscarPorId(id);
    if (reserva === null) {
      throw ERRORES.noEncontrado('reserva');
    }
    if (reserva.usuarioId === actorId) {
      throw ERRORES.autoAprobacionProhibida();
    }
    if (!transicionValida(reserva.estado, 'APROBADA')) {
      throw ERRORES.estadoInvalido(`Una reserva en estado ${reserva.estado} no se puede aprobar`);
    }

    const espacio = this.deps.espacios.buscarPorId(reserva.espacioId);
    if (espacio === null) {
      throw ERRORES.noEncontrado('espacio');
    }
    if (!espacio.activo) {
      throw ERRORES.espacioInactivo();
    }

    return enTransaccion(this.deps.conexion, () => {
      const solapadas = this.deps.reservas.buscarSolapadas(
        reserva.espacioId,
        reserva.fecha,
        reserva.horaInicio,
        reserva.horaFin,
        reserva.id,
      );
      if (solapadas.length > 0) {
        throw ERRORES.espacioOcupado([
          {
            campo: 'horaInicio',
            mensaje: `La franja ya fue ocupada por la reserva ${solapadas[0]?.id ?? '?'}`,
          },
        ]);
      }

      const ahora = marcaTiempo(this.deps.reloj.ahora());
      const actualizada = this.deps.reservas.actualizarEstado(
        id,
        'APROBADA',
        { motivo: null, revisorId: actorId },
        ahora,
      );

      this.deps.bus.emitir({
        tipo: 'RESERVA_APROBADA',
        actorId,
        entidadTipo: 'RESERVA',
        entidadId: id,
        datos: { estadoAnterior: reserva.estado },
      });

      if (actualizada === null) {
        throw ERRORES.noEncontrado('reserva');
      }
      return actualizada;
    });
  }

  /** Rechazar una solicitud pendiente, con motivo obligatorio. */
  rechazar(id: number, actorId: number, motivo: string): ReservaDetallada {
    const reserva = this.deps.reservas.buscarPorId(id);
    if (reserva === null) {
      throw ERRORES.noEncontrado('reserva');
    }
    if (reserva.usuarioId === actorId) {
      throw ERRORES.autoAprobacionProhibida();
    }
    if (!transicionValida(reserva.estado, 'RECHAZADA')) {
      throw ERRORES.estadoInvalido(`Una reserva en estado ${reserva.estado} no se puede rechazar`);
    }
    if (motivo.trim().length < 10) {
      throw ERRORES.validacion('El motivo del rechazo es obligatorio', [
        { campo: 'motivo', mensaje: 'El motivo debe tener al menos 10 caracteres' },
      ]);
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    const actualizada = this.deps.reservas.actualizarEstado(
      id,
      'RECHAZADA',
      { motivo: motivo.trim(), revisorId: actorId },
      ahora,
    );

    this.deps.bus.emitir({
      tipo: 'RESERVA_RECHAZADA',
      actorId,
      entidadTipo: 'RESERVA',
      entidadId: id,
      datos: { motivo: motivo.trim(), estadoAnterior: reserva.estado },
    });

    if (actualizada === null) {
      throw ERRORES.noEncontrado('reserva');
    }
    return actualizada;
  }

  /** Cola de solicitudes pendientes, con filtros opcionales. */
  listarPendientes(
    criterios: { espacioId?: number | undefined; fecha?: string | undefined },
    paginacion: ParametrosPaginacion,
  ): Coleccion<ReservaDetallada> {
    return this.listar({ ...criterios, estado: 'PENDIENTE' as EstadoReserva }, paginacion);
  }

  // ------------------------------------------------------------------
  // Reglas de validacion
  // ------------------------------------------------------------------

  private validarCoherencia(datos: SolicitudCrearReserva): void {
    const detalles: { campo: string; mensaje: string }[] = [];

    if (!esFechaValida(datos.fecha)) {
      detalles.push({ campo: 'fecha', mensaje: 'La fecha debe existir en el calendario' });
    } else if (esFechaPasada(datos.fecha, fechaCivil(this.deps.reloj.ahora()))) {
      detalles.push({ campo: 'fecha', mensaje: 'La fecha no puede estar en el pasado' });
    }

    if (datos.horaInicio >= datos.horaFin) {
      detalles.push({ campo: 'horaFin', mensaje: 'La hora de fin debe ser posterior a la hora de inicio' });
    } else if (minutosEntre(datos.horaInicio, datos.horaFin) < this.deps.duracionMinimaMinutos) {
      detalles.push({
        campo: 'horaFin',
        mensaje: `La duracion minima de una reserva es de ${this.deps.duracionMinimaMinutos} minutos`,
      });
    }

    if (detalles.length > 0) {
      throw ERRORES.validacion('Los datos de la reserva no son validos', detalles);
    }
  }

  private validarAnticipacion(datos: SolicitudCrearReserva): void {
    const ahora = this.deps.reloj.ahora();
    const inicio = new Date(`${datos.fecha}T${datos.horaInicio}:00`);
    const diferenciaHoras = (inicio.getTime() - ahora.getTime()) / (1000 * 60 * 60);

    if (diferenciaHoras < this.deps.anticipacionMinimaHoras) {
      throw ERRORES.anticipacionInsuficiente([
        {
          campo: 'fecha',
          mensaje: `La reserva requiere al menos ${this.deps.anticipacionMinimaHoras} horas de anticipacion`,
        },
      ]);
    }
  }

  private validarHorario(espacio: Espacio, datos: SolicitudCrearReserva): void {
    const apertura = aMinutos(espacio.horarioApertura);
    const cierre = aMinutos(espacio.horarioCierre);
    const inicio = aMinutos(datos.horaInicio);
    const fin = aMinutos(datos.horaFin);

    if (inicio < apertura || fin > cierre) {
      throw ERRORES.fueraDeHorario([
        {
          campo: 'horaInicio',
          mensaje: `El espacio funciona de ${espacio.horarioApertura} a ${espacio.horarioCierre}`,
        },
      ]);
    }
  }

  private validarCapacidad(espacio: Espacio, datos: SolicitudCrearReserva): void {
    if (datos.asistentes !== null && datos.asistentes > espacio.capacidad) {
      throw ERRORES.capacidadExcedida([
        {
          campo: 'asistentes',
          mensaje: `El espacio tiene una capacidad de ${espacio.capacidad} personas`,
        },
      ]);
    }
  }
}
