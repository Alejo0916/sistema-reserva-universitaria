import jwt from 'jsonwebtoken';

export interface ContenidoToken {
  sub: number;
  tv: number;
}

export interface ServicioTokens {
  emitir(usuarioId: number, tokenVersion: number): string;
  verificar(token: string): ContenidoToken | null;
}

export function crearServicioTokens(secreto: string, duracion: string): ServicioTokens {
  return {
    emitir(usuarioId: number, tokenVersion: number): string {
      const contenido: ContenidoToken = { sub: usuarioId, tv: tokenVersion };
      return jwt.sign(contenido, secreto, { expiresIn: duracion } as jwt.SignOptions);
    },
    verificar(token: string): ContenidoToken | null {
      try {
        const decodificado = jwt.verify(token, secreto) as unknown;
        if (typeof decodificado !== 'object' || decodificado === null) {
          return null;
        }
        const posible = decodificado as Record<string, unknown>;
        if (typeof posible.sub !== 'number' || typeof posible.tv !== 'number') {
          return null;
        }
        return { sub: posible.sub, tv: posible.tv };
      } catch {
        return null;
      }
    },
  };
}
