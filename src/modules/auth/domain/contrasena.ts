import bcrypt from 'bcryptjs';

const RONDAS = 10;

/** Genera el hash de una contrasena con bcrypt. */
export async function hashContrasena(contrasena: string): Promise<string> {
  return bcrypt.hash(contrasena, RONDAS);
}

/** Verifica una contrasena frente a su hash bcrypt. */
export async function verificarContrasena(contrasena: string, hash: string): Promise<boolean> {
  return bcrypt.compare(contrasena, hash);
}

/**
 * Valida la robustez de una contrasena: minimo 8 caracteres, al menos una
 * letra y al menos un digito.
 */
export function contrasenaSegura(contrasena: string): boolean {
  if (contrasena.length < 8) {
    return false;
  }
  return /[A-Za-z]/.test(contrasena) && /\d/.test(contrasena);
}
