export interface EventoRegistro {
  id: number;
  tipo: string;
  actorId: number | null;
  actorNombre: string | null;
  entidadTipo: string;
  entidadId: number | null;
  datos: Record<string, unknown>;
  creadoEn: string;
}

export interface CriteriosEvento {
  tipo?: string | undefined;
  entidadTipo?: string | undefined;
  entidadId?: number | undefined;
  desde?: string | undefined;
  hasta?: string | undefined;
}
