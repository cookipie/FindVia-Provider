-- FindVia Provider: enforce document metadata checks on databases where the table
-- was created by migration 002 before migration 016 added these checks.
-- NOT VALID preserves any historical rows while enforcing the rules for new/changed rows.
begin;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_verification_documents'::regclass
      and conname = 'provider_verification_documents_filename_length_check'
  ) then
    alter table public.provider_verification_documents
      add constraint provider_verification_documents_filename_length_check
      check (char_length(original_filename) between 1 and 255) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_verification_documents'::regclass
      and conname = 'provider_verification_documents_mime_type_check'
  ) then
    alter table public.provider_verification_documents
      add constraint provider_verification_documents_mime_type_check
      check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.provider_verification_documents'::regclass
      and conname = 'provider_verification_documents_storage_owner_path_check'
  ) then
    alter table public.provider_verification_documents
      add constraint provider_verification_documents_storage_owner_path_check
      check (storage_path like provider_id::text || '/%') not valid;
  end if;
end;
$$;

commit;
