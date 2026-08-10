-- =========================================================
-- Árbol Familiar — esquema inicial (Etapa 2)
-- =========================================================
-- Refleja las entidades definidas en la Especificación Funcional v1.0:
-- Personas, Relaciones, Documentos, Bitácora.
--
-- Notas de diseño:
-- - Uso solo dos usuarios (los dueños del proyecto), sin roles complejos:
--   RLS se limita a "cualquier usuario autenticado puede leer y escribir".
-- - Las relaciones se separan en filiación (padre/madre-hijo) y cónyuge,
--   porque son de naturaleza distinta y así se evitan combinaciones inválidas.
-- - "estado_informacion" y el "estado" de la bitácora habilitan la
--   codificación sutil de confirmada/pendiente/incompleta que pide el documento.
-- =========================================================

-- ---------------------------------------------------------
-- Función auxiliar: mantiene updated_at al día
-- ---------------------------------------------------------
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------
-- Personas
-- ---------------------------------------------------------
create table personas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  apellido text not null,
  genero text not null default 'no_definido'
    check (genero in ('masculino', 'femenino', 'no_definido')),
  fecha_nacimiento date,
  lugar_nacimiento text,
  fecha_fallecimiento date,
  lugar_fallecimiento text,
  notas text,
  estado_informacion text not null default 'pendiente'
    check (estado_informacion in ('confirmada', 'pendiente', 'incompleta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger personas_set_updated_at
  before update on personas
  for each row execute function set_updated_at();

-- ---------------------------------------------------------
-- Relaciones de filiación (padre/madre → hijo)
-- Una fila por vínculo padre-hijo; una persona puede tener
-- hasta dos filas como hijo_id (un padre y una madre).
-- ---------------------------------------------------------
create table relaciones_filiacion (
  id uuid primary key default gen_random_uuid(),
  padre_id uuid not null references personas(id) on delete cascade,
  hijo_id uuid not null references personas(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint filiacion_no_auto_referencia check (padre_id <> hijo_id),
  constraint filiacion_unica unique (padre_id, hijo_id)
);

create index idx_filiacion_padre on relaciones_filiacion(padre_id);
create index idx_filiacion_hijo on relaciones_filiacion(hijo_id);

-- ---------------------------------------------------------
-- Relaciones de cónyuge / pareja
-- ---------------------------------------------------------
create table relaciones_conyuge (
  id uuid primary key default gen_random_uuid(),
  persona1_id uuid not null references personas(id) on delete cascade,
  persona2_id uuid not null references personas(id) on delete cascade,
  fecha_inicio date,
  fecha_fin date,
  notas text,
  created_at timestamptz not null default now(),
  constraint conyuge_no_auto_referencia check (persona1_id <> persona2_id)
);

create index idx_conyuge_persona1 on relaciones_conyuge(persona1_id);
create index idx_conyuge_persona2 on relaciones_conyuge(persona2_id);

-- ---------------------------------------------------------
-- Documentos (actas de nacimiento, matrimonio, defunción, etc.)
-- El archivo real vive en Supabase Storage; acá se guarda la referencia.
-- ---------------------------------------------------------
create table documentos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'otro'
    check (tipo in ('nacimiento', 'matrimonio', 'defuncion', 'otro')),
  titulo text not null,
  descripcion text,
  archivo_url text,
  fecha_documento date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger documentos_set_updated_at
  before update on documentos
  for each row execute function set_updated_at();

-- Relación muchos-a-muchos: un documento puede involucrar a varias personas
-- (ej. un acta de matrimonio) y una persona puede tener varios documentos.
create table documento_persona (
  documento_id uuid not null references documentos(id) on delete cascade,
  persona_id uuid not null references personas(id) on delete cascade,
  primary key (documento_id, persona_id)
);

create index idx_documento_persona_persona on documento_persona(persona_id);

-- ---------------------------------------------------------
-- Bitácora (cuaderno de trabajo de la investigación)
-- ---------------------------------------------------------
create table bitacora (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'nota'
    check (tipo in ('nota', 'hipotesis', 'duda', 'hallazgo', 'tarea_pendiente', 'documento_pendiente')),
  contenido text not null,
  persona_id uuid references personas(id) on delete set null,
  estado text not null default 'abierta'
    check (estado in ('abierta', 'resuelta')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger bitacora_set_updated_at
  before update on bitacora
  for each row execute function set_updated_at();

create index idx_bitacora_persona on bitacora(persona_id);

-- ---------------------------------------------------------
-- Row Level Security
-- Sin sistema de permisos complejo: cualquier usuario autenticado
-- (los dos usuarios del proyecto) puede leer y escribir todo.
-- ---------------------------------------------------------
alter table personas enable row level security;
alter table relaciones_filiacion enable row level security;
alter table relaciones_conyuge enable row level security;
alter table documentos enable row level security;
alter table documento_persona enable row level security;
alter table bitacora enable row level security;

create policy "autenticados_acceso_total_personas" on personas
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "autenticados_acceso_total_filiacion" on relaciones_filiacion
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "autenticados_acceso_total_conyuge" on relaciones_conyuge
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "autenticados_acceso_total_documentos" on documentos
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "autenticados_acceso_total_documento_persona" on documento_persona
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

create policy "autenticados_acceso_total_bitacora" on bitacora
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
