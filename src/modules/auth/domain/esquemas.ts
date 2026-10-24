import { z } from 'zod';

export const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Esquema de los datos de registro publico y de alta por administrador. */
export const esquemaRegistro = z.object({
  nombre: z.string().trim().min(3, 'El nombre debe tener al menos 3 caracteres').max(120, 'El nombre es demasiado largo'),
  email: z.string().trim().toLowerCase().regex(RE_EMAIL, 'El correo electronico no tiene un formato valido'),
  contrasena: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Za-z]/, 'La contrasena debe contener al menos una letra')
    .regex(/\d/, 'La contrasena debe contener al menos un digito'),
  rol: z.string().trim().optional(),
});

export type DatosRegistro = z.infer<typeof esquemaRegistro>;

/** Esquema del inicio de sesion. */
export const esquemaLogin = z.object({
  email: z.string().trim().toLowerCase().regex(RE_EMAIL, 'El correo electronico no tiene un formato valido'),
  contrasena: z.string().min(1, 'La contrasena es obligatoria'),
});

export type DatosLogin = z.infer<typeof esquemaLogin>;

/** Esquema de la actualizacion de un usuario por el administrador. */
export const esquemaActualizacionUsuario = z.object({
  nombre: z.string().trim().min(3).max(120).optional(),
  email: z.string().trim().toLowerCase().regex(RE_EMAIL).optional(),
  rol: z.string().trim().optional(),
  activo: z.boolean().optional(),
});

export type DatosActualizacionUsuario = z.infer<typeof esquemaActualizacionUsuario>;

/** Esquema del restablecimiento de contrasena. */
export const esquemaRestablecerContrasena = z.object({
  contrasena: z
    .string()
    .min(8, 'La contrasena debe tener al menos 8 caracteres')
    .regex(/[A-Za-z]/, 'La contrasena debe contener al menos una letra')
    .regex(/\d/, 'La contrasena debe contener al menos un digito'),
});

export type DatosRestablecerContrasena = z.infer<typeof esquemaRestablecerContrasena>;
