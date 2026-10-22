-- FindVia Provider: keep offer submission aligned with multi-area job discovery.
-- Providers may submit offers only for an open job in one of their configured
-- service areas (or the legacy single area when no multi-area rows exist).

drop policy if exists "verified providers submit own pending offer" on public.job_offers;

create policy "verified providers submit own pending offer"
on public.job_offers
for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and status = 'pending'
  and public.has_role('provider')
  and exists (
    select 1
    from public.provider_profiles p
    where p.user_id = (select auth.uid())
      and p.verification_status = 'approved'
  )
  and exists (
    select 1
    from public.jobs j
    join public.provider_profiles p on p.user_id = (select auth.uid())
    join public.provider_services ps
      on ps.provider_id = p.user_id and ps.category_id = j.category_id
    where j.id = job_id
      and j.status = 'open'
      and p.is_available
      and (
        exists (
          select 1
          from public.provider_service_areas psa
          where psa.provider_id = p.user_id
            and psa.service_area_id = j.service_area_id
        )
        or (
          p.service_area_id = j.service_area_id
          and not exists (
            select 1
            from public.provider_service_areas psa
            where psa.provider_id = p.user_id
          )
        )
      )
  )
);
