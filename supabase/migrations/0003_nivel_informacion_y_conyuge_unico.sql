-- =========================================================
-- Migración 0003 — integración de relaciones + revisión de
-- "estado_informacion"
-- =========================================================

-- ---------------------------------------------------------
-- 1) Vínculo de cónyuge activo único (por par de personas)
-- ---------------------------------------------------------
-- relaciones-actions.ts ya maneja el error de unicidad (código 23505)
-- al crear o reabrir un vínculo de cónyuge, asumiendo que la base impide
-- dos vínculos ACTIVOS (fecha_fin is null) entre el mismo par de personas.
-- Esa restricción todavía no existía: la agregamos acá como índice único
-- parcial. Se normaliza el par con least/greatest para que no importe en
-- qué orden se cargaron persona1_id/persona2_id.
create unique index if not exists conyuge_activo_unico
  on relaciones_conyuge (
    least(persona1_id, persona2_id),
    greatest(persona1_id, persona2_id)
  )
  where fecha_fin is null;

-- ---------------------------------------------------------
-- 2) "estado_informacion" -> "nivel_informacion" (indicador, no traba)
-- ---------------------------------------------------------
-- Cambio de concepto: esto deja de ser un estado de validación
-- (confirmada/pendiente/incompleta) y pasa a ser un indicador puramente
-- informativo del nivel de datos disponibles sobre una persona
-- (bajo/medio/alto). Nunca bloquea la creación de personas, relaciones
-- ni su incorporación al árbol.
--
-- El nivel "alto" depende de si hay documentos asociados (tabla
-- documento_persona), un dato que no vive en la fila de personas. Por
-- eso el nivel no se guarda como columna: se calcula en la capa de
-- aplicación (ver /lib/estado-informacion.ts y /lib/personas.ts) cada
-- vez que se listan personas. Esto evita tener que mantener sincronizada
-- una columna con triggers cada vez que se sube o borra un documento, y
-- garantiza que el indicador esté siempre actualizado.
--
-- Se elimina la columna vieja: su check constraint (valores
-- confirmada/pendiente/incompleta) ya no aplica y nada la va a usar.
alter table personas
  drop column if exists estado_informacion;
