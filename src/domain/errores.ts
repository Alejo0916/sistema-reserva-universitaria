export interface DetalleError {
  campo?: string;
  mensaje: string;
}

export interface OpcionesError {
  detalles?: DetalleError[];
  causa?: unknown;
}

/**
 * Error de dominio: transporta el codigo de error estable (parte del
 * contrato HTTP definido en design.md, decision D7) y el estado HTTP
 * correspondiente.
 */
export class ErrorDominio extends Error {
  readonly codigo: string;
  readonly estado: number;
  readonly detalles: DetalleError[];

  constructor(codigo: string, mensaje: string, estado: number, opciones: OpcionesError = {}) {
    super(mensaje, { cause: opciones.causa });
    this.name = 'ErrorDominio';
    this.codigo = codigo;
    this.estado = estado;
    this.detalles = opciones.detalles ?? [];
  }
}

/**
 * Codigos de "no encontrado" por recurso. El genero del codigo forma parte
 * del contrato de la API, de modo que se declaran de forma explicita y no se
 * derivan automaticamente.
 */
const CODIGOS_NO_ENCONTRADO: Record<string, string> = {
  reserva: 'RESERVA_NO_ENCONTRADA',
  espacio: 'ESPACIO_NO_ENCONTRADO',
  usuario: 'USUARIO_NO_ENCONTRADO',
};

export const ERRORES = {
  validacion: (mensaje = 'Los datos enviados no son validos', detalles: DetalleError[] = []) =>
    new ErrorDominio('VALIDACION', mensaje, 422, { detalles }),
  noAutenticado: (mensaje = 'Se requiere autenticacion') =>
    new ErrorDominio('NO_AUTENTICADO', mensaje, 401),
  credencialesInvalidas: (mensaje = 'Las credenciales no son validas') =>
    new ErrorDominio('CREDENCIALES_INVALIDAS', mensaje, 401),
  demasiadosIntentos: (mensaje = 'Demasiados intentos fallidos, intente mas tarde') =>
    new ErrorDominio('DEMASIADOS_INTENTOS', mensaje, 429),
  permisoDenegado: (permiso: string) =>
    new ErrorDominio('PERMISO_DENEGADO', `No cuenta con el permiso ${permiso}`, 403),
  autoAprobacionProhibida: () =>
    new ErrorDominio('AUTO_APROBACION_PROHIBIDA', 'No puede resolver una solicitud que usted mismo creo', 403),
  noEncontrado: (recurso: string) =>
    new ErrorDominio(
      CODIGOS_NO_ENCONTRADO[recurso] ?? `${recurso.toUpperCase()}_NO_ENCONTRADO`,
      `${recurso} no encontrado`,
      404,
    ),
  duplicado: (codigo: string, mensaje: string) => new ErrorDominio(codigo, mensaje, 409),
  estadoInvalido: (mensaje = 'La transicion de estado no es valida') =>
    new ErrorDominio('ESTADO_INVALIDO', mensaje, 409),
  espacioOcupado: (detalles: DetalleError[] = []) =>
    new ErrorDominio('ESPACIO_OCUPADO', 'El espacio ya tiene una reserva activa en esa franja', 409, { detalles }),
  espacioInactivo: () =>
    new ErrorDominio('ESPACIO_INACTIVO', 'El espacio se encuentra inactivo y no admite reservas', 409),
  espacioConReservasActivas: () =>
    new ErrorDominio(
      'ESPACIO_CON_RESERVAS_ACTIVAS',
      'El espacio tiene reservas activas y no puede desactivarse',
      409,
    ),
  anticipacionInsuficiente: (detalles: DetalleError[] = []) =>
    new ErrorDominio(
      'ANTICIPACION_INSUFICIENTE',
      'La reserva no cumple la anticipacion minima requerida',
      422,
      { detalles },
    ),
  fueraDeHorario: (detalles: DetalleError[] = []) =>
    new ErrorDominio('FUERA_DE_HORARIO', 'La reserva no cabe dentro del horario del espacio', 422, { detalles }),
  capacidadExcedida: (detalles: DetalleError[] = []) =>
    new ErrorDominio('CAPACIDAD_EXCEDIDA', 'El numero de asistentes supera la capacidad del espacio', 422, { detalles }),
  rolNoPermitido: (detalles: DetalleError[] = []) =>
    new ErrorDominio('ROL_NO_PERMITIDO', 'El rol solicitado no puede asignarse en esta operacion', 422, { detalles }),
  rolDesconocido: (detalles: DetalleError[] = []) =>
    new ErrorDominio('ROL_DESCONOCIDO', 'El rol indicado no existe en el catalogo', 422, { detalles }),
  tipoEspacioDesconocido: (detalles: DetalleError[] = []) =>
    new ErrorDominio('TIPO_ESPACIO_DESCONOCIDO', 'El tipo de espacio no existe en el catalogo', 422, { detalles }),
  automodificacionProhibida: (mensaje = 'No puede modificar su propia cuenta') =>
    new ErrorDominio('AUTOMODIFICACION_PROHIBIDA', mensaje, 409),
} as const;
