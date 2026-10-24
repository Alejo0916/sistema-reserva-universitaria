-- ===========================================================================
-- SIGREA - Esquema de la base de datos (SQLite)
--
-- Ver design.md, decision D12. Siete tablas, restricciones declarativas,
-- indices para las consultas de disponibilidad y auditoria.
-- ===========================================================================

CREATE TABLE IF NOT EXISTS roles (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre        TEXT    NOT NULL UNIQUE,
  descripcion   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS permisos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  clave         TEXT    NOT NULL UNIQUE,
  descripcion   TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS rol_permisos (
  rol_id        INTEGER NOT NULL REFERENCES roles(id)      ON DELETE CASCADE,
  permiso_id    INTEGER NOT NULL REFERENCES permisos(id)  ON DELETE CASCADE,
  PRIMARY KEY (rol_id, permiso_id)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre         TEXT    NOT NULL,
  email          TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash  TEXT    NOT NULL,
  rol_id         INTEGER NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  activo         INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  token_version  INTEGER NOT NULL DEFAULT 1,
  creado_en      TEXT    NOT NULL,
  actualizado_en TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS espacios (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo            TEXT    NOT NULL UNIQUE,
  nombre            TEXT    NOT NULL,
  tipo              TEXT    NOT NULL CHECK (tipo IN ('LABORATORIO', 'AUDITORIO', 'SALA_COMPUTO', 'SALA_REUNION', 'SEMINARIO')),
  descripcion       TEXT,
  capacidad         INTEGER NOT NULL CHECK (capacidad > 0),
  edificio          TEXT,
  piso              TEXT,
  horario_apertura  TEXT    NOT NULL CHECK (horario_apertura LIKE '__:__'),
  horario_cierre    TEXT    NOT NULL CHECK (horario_cierre LIKE '__:__'),
  activo            INTEGER NOT NULL DEFAULT 1 CHECK (activo IN (0, 1)),
  creado_en         TEXT    NOT NULL,
  actualizado_en    TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS reservas (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  espacio_id    INTEGER NOT NULL REFERENCES espacios(id) ON DELETE RESTRICT,
  usuario_id    INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
  fecha         TEXT    NOT NULL,
  hora_inicio   TEXT    NOT NULL CHECK (hora_inicio LIKE '__:__'),
  hora_fin      TEXT    NOT NULL CHECK (hora_fin LIKE '__:__'),
  estado        TEXT    NOT NULL CHECK (estado IN ('PENDIENTE', 'APROBADA', 'RECHAZADA', 'CANCELADA')),
  justificacion TEXT    NOT NULL,
  asistentes    INTEGER CHECK (asistentes IS NULL OR asistentes > 0),
  motivo        TEXT,
  revisor_id    INTEGER REFERENCES usuarios(id) ON DELETE RESTRICT,
  creado_en     TEXT    NOT NULL,
  actualizado_en TEXT   NOT NULL,
  CHECK (hora_inicio < hora_fin)
);

CREATE TABLE IF NOT EXISTS eventos (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo          TEXT    NOT NULL,
  actor_id      INTEGER REFERENCES usuarios(id) ON DELETE SET NULL,
  entidad_tipo  TEXT    NOT NULL,
  entidad_id    INTEGER,
  datos         TEXT    NOT NULL DEFAULT '{}',
  creado_en     TEXT    NOT NULL
);

-- Indices de la consulta de disponibilidad y de la exclusion de franjas.
CREATE INDEX IF NOT EXISTS idx_reservas_espacio_fecha_estado
  ON reservas (espacio_id, fecha, estado);

-- Indice del filtro por solicitante.
CREATE INDEX IF NOT EXISTS idx_reservas_usuario_fecha
  ON reservas (usuario_id, fecha);

-- Indices de la bitacora.
CREATE INDEX IF NOT EXISTS idx_eventos_entidad
  ON eventos (entidad_tipo, entidad_id);

CREATE INDEX IF NOT EXISTS idx_eventos_creado_en
  ON eventos (creado_en);

CREATE INDEX IF NOT EXISTS idx_eventos_tipo
  ON eventos (tipo);
