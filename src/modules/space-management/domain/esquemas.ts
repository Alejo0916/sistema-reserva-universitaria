import { z } from 'zod';

export const RE_CODIGO_ESPACIO = /^[A-Z0-9-]{3,20}$/;
export const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const TIPOS_ESPACIO_VALIDOS = [
  'LABORATORIO',
  'AUDITORIO',
  'SALA_COMPUTO',
  'SALA_REUNION',
  'SEMINARIO',
] as const;

export const esquemaEspacio = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(RE_CODIGO_ESPACIO, 'El codigo debe tener entre 3 y 20 caracteres, con letras mayusculas, digitos o guiones'),
  nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120, 'El nombre es demasiado largo'),
  tipo: z.enum(TIPOS_ESPACIO_VALIDOS, {
    message: 'El tipo de espacio no pertenece al catalogo',
  }),
  descripcion: z.string().trim().max(500).nullable().optional(),
  capacidad: z.number().int().positive('La capacidad debe ser un entero mayor que cero').max(10000),
  edificio: z.string().trim().max(80).nullable().optional(),
  piso: z.string().trim().max(20).nullable().optional(),
  horarioApertura: z.string().regex(RE_HORA, 'El horario de apertura debe tener el formato HH:MM').optional(),
  horarioCierre: z.string().regex(RE_HORA, 'El horario de cierre debe tener el formato HH:MM').optional(),
  activo: z.boolean().optional(),
});

export type DatosEspacio = z.infer<typeof esquemaEspacio>;

export const esquemaActualizacionEspacio = esquemaEspacio.partial();

export type DatosActualizacionEspacio = z.infer<typeof esquemaActualizacionEspacio>;
