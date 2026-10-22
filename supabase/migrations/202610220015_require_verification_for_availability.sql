-- FindVia Provider: an unverified provider must not mark themselves available.
-- Apply after 202610220014_fix_multi_area_offer_policy.sql.
drop policy if exists "provider updates own non-verification fields" on public.provider_profiles;
drop policy if exists "provider updates own profile fields" on public.provider_profiles;

create policy "provider updates own non-verification fields"
on public.provider_profiles
for update to authenticated
using (
  user_id = (select auth.uid())
  and public.has_role('provider')
)
with check (
  user_id = (select auth.uid())
  and public.has_role('provider')
  and (is_available = false or verification_status = 'approved')
);
