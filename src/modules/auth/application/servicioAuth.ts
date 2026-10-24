import type { RepositorioUsuarios } from '../../../db/repositorios/usuarioRepo.js';
import type { RepositorioRoles } from '../../../db/repositorios/rolRepo.js';
import type { Reloj } from '../../../shared/reloj.js';
import type { BusEventos } from '../../../shared/eventBus.js';
import { ERRORES } from '../../../domain/errores.js';
import { fechaCivil, marcaTiempo } from '../../../domain/tiempo.js';
import { hashContrasena, verificarContrasena, contrasenaSegura } from '../domain/contrasena.js';
import type { ServicioTokens } from '../domain/token.js';
import type { LimitadorIntentos } from '../domain/limitadorIntentos.js';
import type { UsuarioAutenticado } from '../../rbac/domain/tipos.js';
import type { Usuario } from '../../user-management/domain/usuario.js';

export interface ResultadoSesion {
  token: string;
  usuario: Usuario;
}

export interface DependenciasAuth {
  usuarios: RepositorioUsuarios;
  roles: RepositorioRoles;
  tokens: ServicioTokens;
  limitador: LimitadorIntentos;
  bus: BusEventos;
  reloj: Reloj;
}

export class ServicioAuth {
  constructor(private readonly deps: DependenciasAuth) {}

  /**
   * Registro publico. Asigna SIEMPRE el rol ESTUDIANTE y rechaza con
   * ROL_NO_PERMITIDO cualquier otro rol (spec auth, H-01 de la revision).
   */
  async registrar(datos: {
    nombre: string;
    email: string;
    contrasena: string;
    rol?: string | undefined;
  }): Promise<ResultadoSesion> {
    if (datos.rol !== undefined && datos.rol !== 'ESTUDIANTE') {
      throw ERRORES.rolNoPermitido([
        { campo: 'rol', mensaje: 'El registro publico solo permite el rol ESTUDIANTE' },
      ]);
    }
    if (!contrasenaSegura(datos.contrasena)) {
      throw ERRORES.validacion('La contrasena no cumple los requisitos de seguridad', [
        { campo: 'contrasena', mensaje: 'Debe tener al menos 8 caracteres, una letra y un digito' },
      ]);
    }
    if (this.deps.usuarios.existeEmail(datos.email)) {
      throw ERRORES.duplicado('EMAIL_DUPLICADO', 'El correo electronico ya esta registrado');
    }

    const rolId = this.deps.roles.idDeRol('ESTUDIANTE');
    if (rolId === null) {
      throw new Error('El catalogo de roles no esta sembrado');
    }

    const ahora = this.deps.reloj.ahora();
    const hash = await hashContrasena(datos.contrasena);
    const usuario = this.deps.usuarios.crear({
      nombre: datos.nombre,
      email: datos.email,
      passwordHash: hash,
      rolId,
      activo: true,
      ahora: marcaTiempo(ahora),
    });

    this.deps.bus.emitir({
      tipo: 'USUARIO_CREADO',
      actorId: usuario.id,
      entidadTipo: 'USUARIO',
      entidadId: usuario.id,
      datos: { email: usuario.email, rol: usuario.rol, origen: 'registro-publico' },
    });

    const token = this.deps.tokens.emitir(usuario.id, usuario.tokenVersion);
    return { token, usuario };
  }

  /** Inicio de sesion con limite de intentos fallidos por correo. */
  async iniciarSesion(datos: { email: string; contrasena: string }): Promise<ResultadoSesion> {
    if (this.deps.limitador.estaBloqueado(datos.email)) {
      throw ERRORES.demasiadosIntentos();
    }

    const usuario = this.deps.usuarios.buscarPorCorreo(datos.email);
    const contrasenaCorrecta =
      usuario !== null && usuario.activo && (await verificarContrasena(datos.contrasena, usuario.passwordHash));

    if (!contrasenaCorrecta || usuario === null) {
      this.deps.limitador.registrarFallo(datos.email);
      this.deps.bus.emitir({
        tipo: 'LOGIN_FALLIDO',
        actorId: null,
        entidadTipo: 'SESION',
        entidadId: null,
        datos: { email: datos.email, fecha: fechaCivil(this.deps.reloj.ahora()) },
      });
      throw ERRORES.credencialesInvalidas();
    }

    this.deps.limitador.registrarExito(datos.email);
    const token = this.deps.tokens.emitir(usuario.id, usuario.tokenVersion);
    return { token, usuario };
  }

  /**
   * Cierra la sesion incrementando la version de token: todos los tokens
   * emitidos previamente quedan invalidos de inmediato.
   */
  cerrarSesion(usuarioId: number): void {
    this.deps.usuarios.incrementarVersionToken(usuarioId, marcaTiempo(this.deps.reloj.ahora()));
  }

  /**
   * Resuelve la identidad a partir de un token. El rol y los permisos se
   * leen de la base de datos en cada peticion, de modo que un cambio de rol
   * surte efecto inmediato (spec auth y rbac, H-02 de la revision).
   */
  async resolverIdentidad(token: string): Promise<UsuarioAutenticado | null> {
    const contenido = this.deps.tokens.verificar(token);
    if (contenido === null) {
      return null;
    }

    const usuario = this.deps.usuarios.buscarPorId(contenido.sub);
    if (usuario === null || !usuario.activo) {
      return null;
    }
    if (usuario.tokenVersion !== contenido.tv) {
      return null;
    }

    return {
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      permisos: new Set(this.deps.roles.permisosDeRol(usuario.rolId)),
      tokenVersion: usuario.tokenVersion,
    };
  }
}
