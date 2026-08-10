-- =========================================================
-- Bucket de Storage para las actas / documentos escaneados
-- =========================================================
insert into storage.buckets (id, name, public)
values ('documentos', 'documentos', false)
on conflict (id) do nothing;

create policy "autenticados_leer_documentos_storage"
  on storage.objects for select
  using (bucket_id = 'documentos' and auth.role() = 'authenticated');

create policy "autenticados_subir_documentos_storage"
  on storage.objects for insert
  with check (bucket_id = 'documentos' and auth.role() = 'authenticated');

create policy "autenticados_actualizar_documentos_storage"
  on storage.objects for update
  using (bucket_id = 'documentos' and auth.role() = 'authenticated');

create policy "autenticados_borrar_documentos_storage"
  on storage.objects for delete
  using (bucket_id = 'documentos' and auth.role() = 'authenticated');
