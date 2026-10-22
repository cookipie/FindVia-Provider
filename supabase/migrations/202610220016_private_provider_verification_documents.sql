-- FindVia Provider: private verification-document records and storage.
-- Apply after 202610220015_require_verification_for_availability.sql.
-- The provider can submit/read their own files; only Management can review metadata.
begin;

create table if not exists public.provider_verification_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  document_type text not null check (document_type in ('identity_proof', 'skill_certificate', 'experience_proof')),
  storage_path text not null unique,
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size_bytes bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  status public.verification_status not null default 'pending',
  reviewer_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  check (storage_path like provider_id::text || '/%')
);

create index if not exists provider_verification_documents_owner_idx
on public.provider_verification_documents(provider_id, created_at desc);

alter table public.provider_verification_documents enable row level security;

drop policy if exists "providers read own verification documents" on public.provider_verification_documents;
create policy "providers read own verification documents"
on public.provider_verification_documents for select to authenticated
using (provider_id = (select auth.uid()) or public.has_role('management'));

drop policy if exists "providers submit own verification documents" on public.provider_verification_documents;
create policy "providers submit own verification documents"
on public.provider_verification_documents for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and public.has_role('provider')
  and status = 'pending'::public.verification_status
  and reviewer_note is null
  and reviewed_by is null
  and reviewed_at is null
);

drop policy if exists "management reviews verification documents" on public.provider_verification_documents;
create policy "management reviews verification documents"
on public.provider_verification_documents for update to authenticated
using (public.has_role('management'))
with check (public.has_role('management'));

create or replace function public.guard_provider_verification_document_review()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.has_role('management') then
    if tg_op = 'INSERT' then
      if new.status <> 'pending'::public.verification_status
        or new.reviewer_note is not null
        or new.reviewed_by is not null
        or new.reviewed_at is not null then
        raise exception 'Only management can set document review fields';
      end if;
    else
      if new.provider_id is distinct from old.provider_id
        or new.document_type is distinct from old.document_type
        or new.storage_path is distinct from old.storage_path
        or new.original_filename is distinct from old.original_filename
        or new.mime_type is distinct from old.mime_type
        or new.file_size_bytes is distinct from old.file_size_bytes
        or new.status is distinct from old.status
        or new.reviewer_note is distinct from old.reviewer_note
        or new.reviewed_by is distinct from old.reviewed_by
        or new.reviewed_at is distinct from old.reviewed_at then
        raise exception 'Only management can change verification document records';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists provider_verification_document_review_guard on public.provider_verification_documents;
create trigger provider_verification_document_review_guard
before insert or update on public.provider_verification_documents
for each row execute function public.guard_provider_verification_document_review();

revoke all on function public.guard_provider_verification_document_review() from public, anon, authenticated;

-- Private bucket: never expose identity documents through public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('provider-verification', 'provider-verification', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "providers upload own verification files" on storage.objects;
create policy "providers upload own verification files"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'provider-verification'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.has_role('provider')
);

drop policy if exists "providers read own verification files" on storage.objects;
create policy "providers read own verification files"
on storage.objects for select to authenticated
using (
  bucket_id = 'provider-verification'
  and (
    public.has_role('management')
    or (
      (storage.foldername(name))[1] = (select auth.uid())::text
      and not exists (
        select 1 from public.provider_verification_documents d
        where d.storage_path = name
      )
    )
  )
);

drop policy if exists "providers delete own verification files" on storage.objects;
create policy "providers delete own verification files"
on storage.objects for delete to authenticated
using (
  bucket_id = 'provider-verification'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.has_role('management')
  )
);

commit;
