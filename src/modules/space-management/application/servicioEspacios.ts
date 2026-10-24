import type { RepositorioEspacios } from '../../../db/repositorios/espacioRepo.js';
import type { Reloj } from '../../../shared/reloj.js';
import type { BusEventos } from '../../../shared/eventBus.js';
import type { Coleccion, ParametrosPaginacion } from '../../../shared/coleccion.js';
import { ERRORES } from '../../../domain/errores.js';
import { marcaTiempo, minutosEntre } from '../../../domain/tiempo.js';
import { esTipoEspacio, type TipoEspacio } from '../../../domain/tipos.js';
import type { Espacio } from '../domain/espacio.js';

export interface DependenciasEspacios {
  espacios: RepositorioEspacios;
  bus: BusEventos;
  reloj: Reloj;
  horarioAperturaPorDefecto: string;
  horarioCierrePorDefecto: string;
}

export class ServicioEspacios {
  constructor(private readonly deps: DependenciasEspacios) {}

  listar(
    criterios: { tipo?: string | undefined; activo?: boolean | undefined },
    paginacion: ParametrosPaginacion,
  ): Coleccion<Espacio> {
    const tipo =
      criterios.tipo !== undefined && esTipoEspacio(criterios.tipo) ? (criterios.tipo as TipoEspacio) : undefined;
    const resultado = this.deps.espacios.listar({ tipo, activo: criterios.activo }, paginacion.pagina, paginacion.limite);
    return { datos: resultado.datos, total: resultado.total, ...paginacion };
  }

  /** Acepta identificador numerico o codigo alfanumerico. */
  obtener(referencia: string): Espacio {
    const espacio = this.deps.espacios.buscarPorReferencia(referencia);
    if (espacio === null) {
      throw ERRORES.noEncontrado('espacio');
    }
    return espacio;
  }

  crear(datos: {
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
  }): Espacio {
    if (!esTipoEspacio(datos.tipo)) {
      throw ERRORES.tipoEspacioDesconocido([{ campo: 'tipo', mensaje: `El tipo ${datos.tipo} no existe` }]);
    }
    if (this.deps.espacios.existeCodigo(datos.codigo)) {
      throw ERRORES.duplicado('CODIGO_ESPACIO_DUPLICADO', 'Ya existe un espacio con ese codigo');
    }

    const horarioApertura = datos.horarioApertura ?? this.deps.horarioAperturaPorDefecto;
    const horarioCierre = datos.horarioCierre ?? this.deps.horarioCierrePorDefecto;

    if (minutosEntre(horarioApertura, horarioCierre) <= 0) {
      throw ERRORES.validacion('El horario de apertura debe ser anterior al de cierre', [
        { campo: 'horarioApertura', mensaje: 'Debe ser anterior a horarioCierre' },
        { campo: 'horarioCierre', mensaje: 'Debe ser posterior a horarioApertura' },
      ]);
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    const espacio = this.deps.espacios.crear({
      codigo: datos.codigo,
      nombre: datos.nombre,
      tipo: datos.tipo,
      descripcion: datos.descripcion ?? null,
      capacidad: datos.capacidad,
      edificio: datos.edificio ?? null,
      piso: datos.piso ?? null,
      horarioApertura,
      horarioCierre,
      activo: datos.activo ?? true,
      ahora,
    });

    this.deps.bus.emitir({
      tipo: 'ESPACIO_CREADO',
      actorId: null,
      entidadTipo: 'ESPACIO',
      entidadId: espacio.id,
      datos: { codigo: espacio.codigo, nombre: espacio.nombre, tipo: espacio.tipo },
    });

    return espacio;
  }

  actualizar(
    referencia: string,
    cambios: {
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
    },
    actorId: number,
  ): Espacio {
    const espacio = this.deps.espacios.buscarPorReferencia(referencia);
    if (espacio === null) {
      throw ERRORES.noEncontrado('espacio');
    }

    if (cambios.tipo !== undefined && !esTipoEspacio(cambios.tipo)) {
      throw ERRORES.tipoEspacioDesconocido([{ campo: 'tipo', mensaje: `El tipo ${cambios.tipo} no existe` }]);
    }
    if (cambios.codigo !== undefined && this.deps.espacios.existeCodigo(cambios.codigo, espacio.id)) {
      throw ERRORES.duplicado('CODIGO_ESPACIO_DUPLICADO', 'Ya existe un espacio con ese codigo');
    }

    const horarioApertura = cambios.horarioApertura ?? espacio.horarioApertura;
    const horarioCierre = cambios.horarioCierre ?? espacio.horarioCierre;
    if (minutosEntre(horarioApertura, horarioCierre) <= 0) {
      throw ERRORES.validacion('El horario de apertura debe ser anterior al de cierre', [
        { campo: 'horarioApertura', mensaje: 'Debe ser anterior a horarioCierre' },
        { campo: 'horarioCierre', mensaje: 'Debe ser posterior a horarioApertura' },
      ]);
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    const actualizado = this.deps.espacios.actualizar(
      espacio.id,
      {
        codigo: cambios.codigo,
        nombre: cambios.nombre,
        tipo: cambios.tipo as TipoEspacio | undefined,
        descripcion: cambios.descripcion,
        capacidad: cambios.capacidad,
        edificio: cambios.edificio,
        piso: cambios.piso,
        horarioApertura,
        horarioCierre,
        activo: cambios.activo,
      },
      ahora,
    );

    if (actualizado === null) {
      throw ERRORES.noEncontrado('espacio');
    }

    const tipoEvento = actualizado.activo
      ? cambios.activo === false
        ? 'ESPACIO_DESACTIVADO'
        : 'ESPACIO_ACTUALIZADO'
      : 'ESPACIO_ACTIVADO';

    this.deps.bus.emitir({
      tipo: tipoEvento,
      actorId,
      entidadTipo: 'ESPACIO',
      entidadId: espacio.id,
      datos: { codigo: actualizado.codigo, campos: Object.keys(cambios) },
    });

    return actualizado;
  }

  /**
   * Desactiva un espacio. No se permite si tiene reservas activas, para no
   * dejar solicitudes en un espacio que ya no admite reservas.
   */
  desactivar(referencia: string, actorId: number): Espacio {
    const espacio = this.deps.espacios.buscarPorReferencia(referencia);
    if (espacio === null) {
      throw ERRORES.noEncontrado('espacio');
    }
    if (this.deps.espacios.contarReservasActivas(espacio.id) > 0) {
      throw ERRORES.espacioConReservasActivas();
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    const actualizado = this.deps.espacios.actualizar(espacio.id, { activo: false }, ahora);

    this.deps.bus.emitir({
      tipo: 'ESPACIO_DESACTIVADO',
      actorId,
      entidadTipo: 'ESPACIO',
      entidadId: espacio.id,
      datos: { codigo: espacio.codigo },
    });

    if (actualizado === null) {
      throw ERRORES.noEncontrado('espacio');
    }
    return actualizado;
  }

  activar(referencia: string, actorId: number): Espacio {
    const espacio = this.deps.espacios.buscarPorReferencia(referencia);
    if (espacio === null) {
      throw ERRORES.noEncontrado('espacio');
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    const actualizado = this.deps.espacios.actualizar(espacio.id, { activo: true }, ahora);

    this.deps.bus.emitir({
      tipo: 'ESPACIO_ACTIVADO',
      actorId,
      entidadTipo: 'ESPACIO',
      entidadId: espacio.id,
      datos: { codigo: espacio.codigo },
    });

    if (actualizado === null) {
      throw ERRORES.noEncontrado('espacio');
    }
    return actualizado;
  }
}
