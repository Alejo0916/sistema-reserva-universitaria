import { z } from 'zod';
import { RE_EMAIL } from '../../auth/domain/esquemas.js';

export const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
export const RE_HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const esquemaReserva = z.object({
  espacioId: z.number().int().positive('El espacio es obligatorio'),
  fecha: z.string().regex(RE_FECHA, 'La fecha debe tener el formato YYYY-MM-DD'),
  horaInicio: z.string().regex(RE_HORA, 'La hora de inicio debe tener el formato HH:MM'),
  horaFin: z.string().regex(RE_HORA, 'La hora de fin debe tener el formato HH:MM'),
  justificacion: z
    .string()
    .trim()
    .min(10, 'La justificacion debe tener al menos 10 caracteres')
    .max(500, 'La justificacion es demasiado larga'),
  asistentes: z.number().int().positive().nullable().optional(),
});

export type DatosReserva = z.infer<typeof esquemaReserva>;

export const esquemaDecision = z.object({
  motivo: z
    .string()
    .trim()
    .min(10, 'El motivo debe tener al menos 10 caracteres')
    .max(500, 'El motivo es demasiado largo')
    .optional(),
});

export type DatosDecision = z.infer<typeof esquemaDecision>;

export const esquemaCancelacion = z.object({
  motivo: z.string().trim().min(5).max(500).optional(),
});

export type DatosCancelacion = z.infer<typeof esquemaCancelacion>;

export const esquemaFiltroReservas = z.object({
  espacioId: z.coerce.number().int().positive().optional(),
  usuarioId: z.coerce.number().int().positive().optional(),
  estado: z.enum(['PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA']).optional(),
  fecha: z.string().regex(RE_FECHA, 'La fecha debe tener el formato YYYY-MM-DD').optional(),
});

export type DatosFiltroReservas = z.infer<typeof esquemaFiltroReservas>;

export { RE_EMAIL };
