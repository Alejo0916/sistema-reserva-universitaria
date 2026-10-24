import type { Conexion } from '../../../db/conexion.js';
import { enTransaccion } from '../../../db/transaccion.js';
import type { RepositorioEspacios } from '../../../db/repositorios/espacioRepo.js';
import type { RepositorioReservas } from '../../../db/repositorios/reservaRepo.js';
import type { Reloj } from '../../../shared/reloj.js';
import type { BusEventos } from '../../../shared/eventBus.js';
import type { Coleccion, ParametrosPaginacion } from '../../../shared/coleccion.js';
import { ERRORES } from '../../../domain/errores.js';
import { aMinutos, esFechaPasada, esFechaValida, fechaCivil, formatearHora, fusionarIntervalos, marcaTiempo, minutosEntre, type Intervalo } from '../../../domain/tiempo.js';
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
  limiteHorasConsecutivasMinutos: number;
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

      // 7. Limite de horas consecutivas del usuario. Se computa dentro de la
      //    misma transaccion para que el computo y la insercion sean atomicos.
      this.validarHorasConsecutivas(datos, actorId);

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

    // El limite maximo de duracion se comprueba despues de la coherencia
    // basica, de modo que una franja invertida se reporta como error de
    // validacion y no como exceso de duracion (spec reservation-management,
    // requisito "Validacion de la coherencia de la franja").
    this.validarDuracion(datos);
  }

  /**
   * Limite de duracion por reserva: una reserva individual no puede superar
   * el limite de horas consecutivas (240 minutos por defecto).
   */
  private validarDuracion(datos: SolicitudCrearReserva): void {
    const duracion = minutosEntre(datos.horaInicio, datos.horaFin);
    if (duracion > this.deps.limiteHorasConsecutivasMinutos) {
      throw ERRORES.duracionExcedida([
        {
          campo: 'horaFin',
          mensaje: `La duracion solicitada es de ${duracion} minutos y el maximo permitido es de ${this.deps.limiteHorasConsecutivasMinutos} minutos`,
        },
      ]);
    }
  }

  /**
   * Limite de horas consecutivas del usuario.
   *
   * Computa la union de los intervalos de las reservas activas del usuario
   * en esa fecha (con independencia del espacio) junto con la franja de la
   * nueva solicitud, y rechaza si algun bloque continuo supera el limite.
   *
   * El computo es sobre la union y no sobre la suma de duraciones: las
   * franjas separadas por un hueco no se acumulan (design.md del change
   * `limit-4-horas-consecutivas`, decision D2).
   */
  private validarHorasConsecutivas(datos: SolicitudCrearReserva, actorId: number): void {
    const existentes = this.deps.reservas.listarActivasDeUsuarioEnFecha(actorId, datos.fecha);

    const intervalos: Intervalo[] = existentes.map((reserva) => ({
      inicio: aMinutos(reserva.horaInicio),
      fin: aMinutos(reserva.horaFin),
    }));
    intervalos.push({ inicio: aMinutos(datos.horaInicio), fin: aMinutos(datos.horaFin) });

    const bloques = fusionarIntervalos(intervalos);
    const limite = this.deps.limiteHorasConsecutivasMinutos;

    for (const bloque of bloques) {
      const duracion = bloque.fin - bloque.inicio;
      if (duracion > limite) {
        throw ERRORES.horasConsecutivasExcedidas([
          {
            campo: 'horaInicio',
            mensaje: `El bloque continuo de ${formatearHora(bloque.inicio)} a ${formatearHora(bloque.fin)} suma ${duracion} minutos y el maximo permitido es de ${limite} minutos`,
          },
        ]);
      }
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
