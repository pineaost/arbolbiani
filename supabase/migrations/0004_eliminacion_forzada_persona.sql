-- =========================================================
-- Eliminación forzada y consistente de una persona
-- =========================================================
-- Las FK de relaciones_filiacion, relaciones_conyuge y documento_persona
-- ya usan ON DELETE CASCADE; bitacora usa ON DELETE SET NULL. Esta función
-- concentra la operación de base en una sola transacción y borra solamente
-- los documentos que pasan a quedar sin asociación alguna.

create or replace function public.eliminar_persona_forzada(persona_uuid uuid)
returns table (archivo_url text)
language plpgsql
security invoker
set search_path = public
as $$
declare
  documentos_candidatos uuid[];
begin
  if not exists (select 1 from personas where id = persona_uuid) then
    raise exception 'La persona indicada no existe.';
  end if;

  -- Se recuerdan los documentos asociados antes de que el cascade borre
  -- documento_persona. Después sólo se borran los que sigan sin referencias.
  select coalesce(array_agg(documento_id), '{}'::uuid[])
    into documentos_candidatos
    from documento_persona
   where persona_id = persona_uuid;

  delete from personas where id = persona_uuid;

  return query
  delete from documentos as documento
   where documento.id = any(documentos_candidatos)
     and not exists (
       select 1
         from documento_persona as asociacion
        where asociacion.documento_id = documento.id
     )
  returning documento.archivo_url;
end;
$$;

revoke all on function public.eliminar_persona_forzada(uuid) from public;
grant execute on function public.eliminar_persona_forzada(uuid) to authenticated;
