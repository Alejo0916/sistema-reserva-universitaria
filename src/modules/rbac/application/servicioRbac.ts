import type { RepositorioRoles } from '../../../db/repositorios/rolRepo.js';
import type { Permiso, RolConPermisos } from '../domain/tipos.js';

export class ServicioRbac {
  constructor(private readonly roles: RepositorioRoles) {}

  listarRoles(): RolConPermisos[] {
    return this.roles.listarRoles();
  }

  listarPermisos(): Permiso[] {
    return this.roles.listarPermisos();
  }
}
