import type { TipoEspacio } from '../../../domain/tipos.js';

export interface Espacio {
  id: number;
  codigo: string;
  nombre: string;
  tipo: TipoEspacio;
  descripcion: string | null;
  capacidad: number;
  edificio: string | null;
  piso: string | null;
  horarioApertura: string;
  horarioCierre: string;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}
