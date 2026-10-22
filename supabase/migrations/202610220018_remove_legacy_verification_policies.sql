-- FindVia Provider: remove legacy duplicate RLS policies after the hardened
-- verification-document policies in migration 016 were installed.
-- PostgreSQL combines permissive policies with OR, so keep one clear policy per action.
begin;

drop policy if exists "provider reads own verification documents"
  on public.provider_verification_documents;
drop policy if exists "provider submits own verification documents"
  on public.provider_verification_documents;

drop policy if exists "provider uploads own private verification documents"
  on storage.objects;
drop policy if exists "owners and management read private verification documents"
  on storage.objects;
drop policy if exists "provider removes unregistered verification uploads"
  on storage.objects;

commit;
