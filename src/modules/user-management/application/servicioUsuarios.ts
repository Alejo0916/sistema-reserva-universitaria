import type { RepositorioUsuarios } from '../../../db/repositorios/usuarioRepo.js';
import type { RepositorioRoles } from '../../../db/repositorios/rolRepo.js';
import type { Reloj } from '../../../shared/reloj.js';
import type { BusEventos } from '../../../shared/eventBus.js';
import type { Coleccion, ParametrosPaginacion } from '../../../shared/coleccion.js';
import { ERRORES } from '../../../domain/errores.js';
import { marcaTiempo } from '../../../domain/tiempo.js';
import { esRol } from '../../../domain/tipos.js';
import { hashContrasena, contrasenaSegura } from '../../auth/domain/contrasena.js';
import type { Usuario } from '../domain/usuario.js';

export interface DependenciasUsuarios {
  usuarios: RepositorioUsuarios;
  roles: RepositorioRoles;
  bus: BusEventos;
  reloj: Reloj;
}

export class ServicioUsuarios {
  constructor(private readonly deps: DependenciasUsuarios) {}

  /** Alta de usuario por el administrador, con rol asignable. */
  async crear(datos: {
    nombre: string;
    email: string;
    contrasena: string;
    rol: string;
    activo?: boolean | undefined;
  }): Promise<Usuario> {
    if (!esRol(datos.rol)) {
      throw ERRORES.rolDesconocido([{ campo: 'rol', mensaje: `El rol ${datos.rol} no existe` }]);
    }
    if (!contrasenaSegura(datos.contrasena)) {
      throw ERRORES.validacion('La contrasena no cumple los requisitos de seguridad', [
        { campo: 'contrasena', mensaje: 'Debe tener al menos 8 caracteres, una letra y un digito' },
      ]);
    }
    if (this.deps.usuarios.existeEmail(datos.email)) {
      throw ERRORES.duplicado('EMAIL_DUPLICADO', 'El correo electronico ya esta registrado');
    }

    const rolId = this.deps.roles.idDeRol(datos.rol);
    if (rolId === null) {
      throw ERRORES.rolDesconocido([{ campo: 'rol', mensaje: `El rol ${datos.rol} no existe` }]);
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    const hash = await hashContrasena(datos.contrasena);
    const usuario = this.deps.usuarios.crear({
      nombre: datos.nombre,
      email: datos.email,
      passwordHash: hash,
      rolId,
      activo: datos.activo ?? true,
      ahora,
    });

    this.deps.bus.emitir({
      tipo: 'USUARIO_CREADO',
      actorId: null,
      entidadTipo: 'USUARIO',
      entidadId: usuario.id,
      datos: { email: usuario.email, rol: usuario.rol, origen: 'administracion' },
    });

    return usuario;
  }

  listar(
    criterios: { rol?: string | undefined; activo?: boolean | undefined; texto?: string | undefined },
    paginacion: ParametrosPaginacion,
  ): Coleccion<Usuario> {
    const rol = criterios.rol !== undefined && esRol(criterios.rol) ? criterios.rol : undefined;
    const resultado = this.deps.usuarios.listar(
      { rol, activo: criterios.activo, texto: criterios.texto },
      paginacion.pagina,
      paginacion.limite,
    );
    return { datos: resultado.datos, total: resultado.total, ...paginacion };
  }

  obtener(id: number): Usuario {
    const usuario = this.deps.usuarios.buscarPorId(id);
    if (usuario === null) {
      throw ERRORES.noEncontrado('usuario');
    }
    return usuario;
  }

  /**
   * Actualiza los datos de un usuario. Impide que el administrador se quite
   * su propio rol o se desactive a si mismo (spec user-management, H-08).
   */
  actualizar(
    id: number,
    cambios: { nombre?: string | undefined; email?: string | undefined; rol?: string | undefined; activo?: boolean | undefined },
    actorId: number,
  ): Usuario {
    const usuario = this.deps.usuarios.buscarPorId(id);
    if (usuario === null) {
      throw ERRORES.noEncontrado('usuario');
    }

    if (actorId === id) {
      if (cambios.rol !== undefined && cambios.rol !== usuario.rol) {
        throw ERRORES.automodificacionProhibida('No puede cambiar su propio rol');
      }
      if (cambios.activo === false) {
        throw ERRORES.automodificacionProhibida('No puede desactivar su propia cuenta');
      }
    }

    let rolId = usuario.rolId;
    if (cambios.rol !== undefined) {
      if (!esRol(cambios.rol)) {
        throw ERRORES.rolDesconocido([{ campo: 'rol', mensaje: `El rol ${cambios.rol} no existe` }]);
      }
      const idRol = this.deps.roles.idDeRol(cambios.rol);
      if (idRol === null) {
        throw ERRORES.rolDesconocido([{ campo: 'rol', mensaje: `El rol ${cambios.rol} no existe` }]);
      }
      rolId = idRol;
    }

    if (cambios.email !== undefined && this.deps.usuarios.existeEmail(cambios.email, id)) {
      throw ERRORES.duplicado('EMAIL_DUPLICADO', 'El correo electronico ya esta registrado');
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    const actualizado = this.deps.usuarios.actualizar(
      id,
      {
        nombre: cambios.nombre,
        email: cambios.email,
        rolId,
        activo: cambios.activo,
      },
      ahora,
    );

    if (actualizado === null) {
      throw ERRORES.noEncontrado('usuario');
    }

    const camposModificados: Record<string, unknown> = {};
    if (cambios.nombre !== undefined && cambios.nombre !== usuario.nombre) {
      camposModificados.nombre = cambios.nombre;
    }
    if (cambios.email !== undefined && cambios.email !== usuario.email) {
      camposModificados.email = cambios.email;
    }
    if (cambios.rol !== undefined && cambios.rol !== usuario.rol) {
      camposModificados.rol = cambios.rol;
    }
    if (cambios.activo !== undefined && cambios.activo !== usuario.activo) {
      camposModificados.activo = cambios.activo;
    }

    this.deps.bus.emitir({
      tipo: 'USUARIO_ACTUALIZADO',
      actorId,
      entidadTipo: 'USUARIO',
      entidadId: id,
      datos: camposModificados,
    });

    return actualizado;
  }

  /** Desactiva la cuenta sin perder el historial de sus reservas. */
  desactivar(id: number, actorId: number): Usuario {
    const usuario = this.deps.usuarios.buscarPorId(id);
    if (usuario === null) {
      throw ERRORES.noEncontrado('usuario');
    }
    if (actorId === id) {
      throw ERRORES.automodificacionProhibida('No puede desactivar su propia cuenta');
    }

    const ahora = marcaTiempo(this.deps.reloj.ahora());
    this.deps.usuarios.incrementarVersionToken(id, ahora);
    const actualizado = this.deps.usuarios.actualizar(id, { activo: false }, ahora);

    this.deps.bus.emitir({
      tipo: 'USUARIO_DESACTIVADO',
      actorId,
      entidadTipo: 'USUARIO',
      entidadId: id,
      datos: { email: usuario.email },
    });

    if (actualizado === null) {
      throw ERRORES.noEncontrado('usuario');
    }
    return actualizado;
  }

  /** Restablece la contrasena e invalida los tokens emitidos previamente. */
  async restablecerContrasena(id: number, contrasena: string, actorId: number): Promise<Usuario> {
    const usuario = this.deps.usuarios.buscarPorId(id);
    if (usuario === null) {
      throw ERRORES.noEncontrado('usuario');
    }
    if (!contrasenaSegura(contrasena)) {
      throw ERRORES.validacion('La contrasena no cumple los requisitos de seguridad', [
        { campo: 'contrasena', mensaje: 'Debe tener al menos 8 caracteres, una letra y un digito' },
      ]);
    }

    const hash = await hashContrasena(contrasena);
    this.deps.usuarios.cambiarPassword(id, hash, marcaTiempo(this.deps.reloj.ahora()));

    this.deps.bus.emitir({
      tipo: 'USUARIO_CONTRASENA_RESTABLECIDA',
      actorId,
      entidadTipo: 'USUARIO',
      entidadId: id,
      datos: { email: usuario.email },
    });

    return this.deps.usuarios.buscarPorId(id) as Usuario;
  }
}
