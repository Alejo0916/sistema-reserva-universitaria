import request from 'supertest';
import type { Express } from 'express';
import type { EntornoPrueba } from './entorno.js';
import { CONTRASENA } from './entorno.js';

export interface SesionTest {
  token: string;
  id: number;
  email: string;
  rol: string;
}

export async function iniciarSesion(
  app: Express,
  email: string,
  contrasena: string = CONTRASENA,
): Promise<SesionTest> {
  const respuesta = await request(app).post('/api/auth/login').send({ email, contrasena });
  if (respuesta.status !== 200) {
    throw new Error(
      `No se pudo iniciar sesion para ${email}: ${respuesta.status} ${JSON.stringify(respuesta.body)}`,
    );
  }
  return {
    token: respuesta.body.token as string,
    id: respuesta.body.usuario.id as number,
    email: respuesta.body.usuario.email as string,
    rol: respuesta.body.usuario.rol as string,
  };
}

export function conToken(sesion: SesionTest): Record<string, string> {
  return { Authorization: `Bearer ${sesion.token}` };
}

/** Crea una sesion para un usuario dado registrandolo primero si hace falta. */
export async function registrarYObtenerToken(
  app: Express,
  datos: { nombre: string; email: string; contrasena?: string },
): Promise<SesionTest> {
  const respuesta = await request(app).post('/api/auth/registro').send(datos);
  if (respuesta.status !== 201) {
    throw new Error(
      `No se pudo registrar a ${datos.email}: ${respuesta.status} ${JSON.stringify(respuesta.body)}`,
    );
  }
  return {
    token: respuesta.body.token as string,
    id: respuesta.body.usuario.id as number,
    email: respuesta.body.usuario.email as string,
    rol: respuesta.body.usuario.rol as string,
  };
}

/** Atajo para construir una cabecera de autorizacion a partir del entorno. */
export async function tokenDe(entorno: EntornoPrueba, email: string, contrasena: string = CONTRASENA) {
  return iniciarSesion(entorno.app, email, contrasena);
}

export { CONTRASENA };
export type { EntornoPrueba };
