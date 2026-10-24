import type { TipoEspacio } from '../../domain/tipos.js';

export interface EspacioSemilla {
  codigo: string;
  nombre: string;
  tipo: TipoEspacio;
  descripcion: string;
  capacidad: number;
  edificio: string;
  piso: string;
  horarioApertura: string;
  horarioCierre: string;
}

export interface UsuarioSemilla {
  nombre: string;
  email: string;
  contrasena: string;
  rol: string;
}

/**
 * Datos de ejemplo de la institucion.
 *
 * Las contrasenas de la semilla son deliberadamente debiles y-documentadas:
 * son credenciales de demostracion, no credenciales de produccion. El
 * README indica cambiarlas antes de cualquier uso real.
 */
export const USUARIOS_SEMILLA: UsuarioSemilla[] = [
  {
    nombre: 'Administrador del Sistema',
    email: 'admin@uni.edu',
    contrasena: 'admin1234',
    rol: 'ADMIN',
  },
  {
    nombre: 'Coordinadora Academica',
    email: 'coordinador@uni.edu',
    contrasena: 'coord1234',
    rol: 'COORDINADOR',
  },
  {
    nombre: 'Docente de Quimica',
    email: 'docente@uni.edu',
    contrasena: 'docen1234',
    rol: 'DOCENTE',
  },
  {
    nombre: 'Estudiante de Ingenieria',
    email: 'estudiante@uni.edu',
    contrasena: 'estud1234',
    rol: 'ESTUDIANTE',
  },
];

export const ESPACIOS_SEMILLA: EspacioSemilla[] = [
  {
    codigo: 'LAB-101',
    nombre: 'Laboratorio de Quimica General',
    tipo: 'LABORATORIO',
    descripcion: 'Laboratorio con 24 puestos de trabajo y campanas de ventilacion',
    capacidad: 24,
    edificio: 'Edificio A',
    piso: '1',
    horarioApertura: '08:00',
    horarioCierre: '22:00',
  },
  {
    codigo: 'LAB-205',
    nombre: 'Laboratorio de Fisica Experimental',
    tipo: 'LABORATORIO',
    descripcion: 'Laboratorio de mecanica y termodinamica',
    capacidad: 20,
    edificio: 'Edificio A',
    piso: '2',
    horarioApertura: '08:00',
    horarioCierre: '20:00',
  },
  {
    codigo: 'AUD-MAIN',
    nombre: 'Auditorio Principal',
    tipo: 'AUDITORIO',
    descripcion: 'Auditorio con sistema de sonido y proyeccion',
    capacidad: 200,
    edificio: 'Edificio Central',
    piso: '0',
    horarioApertura: '08:00',
    horarioCierre: '22:00',
  },
  {
    codigo: 'SALA-COMP-3',
    nombre: 'Sala de Computo 3',
    tipo: 'SALA_COMPUTO',
    descripcion: 'Sala con 30 workstations y acceso a la red institucional',
    capacidad: 30,
    edificio: 'Edificio B',
    piso: '3',
    horarioApertura: '08:00',
    horarioCierre: '21:00',
  },
  {
    codigo: 'SALA-REF-12',
    nombre: 'Sala de Reuniones 12',
    tipo: 'SALA_REUNION',
    descripcion: 'Sala de reuniones con capacidad para doce personas',
    capacidad: 12,
    edificio: 'Edificio Central',
    piso: '1',
    horarioApertura: '09:00',
    horarioCierre: '18:00',
  },
  {
    codigo: 'SEM-04',
    nombre: 'Seminario 4',
    tipo: 'SEMINARIO',
    descripcion: 'Aula de seminario con mesa redonda y pantalla',
    capacidad: 40,
    edificio: 'Edificio B',
    piso: '1',
    horarioApertura: '08:00',
    horarioCierre: '20:00',
  },
];
