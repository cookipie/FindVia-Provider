-- FindVia shared backend: provider onboarding and client-side RLS hardening.
-- Apply this migration AFTER 202610210001_shared_core.sql.
-- No client may assign the management role or read completion OTP hashes.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.app_role;
begin
  insert into public.profiles (id, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', new.phone)
  )
  on conflict (id) do nothing;

  -- Only customer/provider can be selected by signup metadata.
  -- Management must always be granted through a trusted administrative process.
  if new.raw_user_meta_data ->> 'app_role' = 'customer' then
    v_role := 'customer'::public.app_role;
  else
    v_role := 'provider'::public.app_role;
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, v_role)
  on conflict (user_id, role) do nothing;

  if v_role = 'provider'::public.app_role then
    insert into public.provider_profiles (user_id)
    values (new.id)
    on conflict (user_id) do nothing;

    insert into public.wallet_accounts (provider_id)
    values (new.id)
    on conflict (provider_id) do nothing;
  end if;

  return new;
end;
$$;

-- The OTP hash must never be readable from the browser. Verification will be
-- implemented through a trusted server-side function, not table reads.
drop policy if exists "participants can see otp metadata only" on public.completion_otps;

-- A customer may edit their own open job, but cannot use a direct table update
-- to mark it matched, active, completed or disputed.
drop policy if exists "customer updates own open jobs" on public.jobs;
create policy "customer updates own open jobs" on public.jobs
for update to authenticated
using (customer_id = (select auth.uid()) and status = 'open')
with check (customer_id = (select auth.uid()) and status = 'open');

-- A provider may withdraw a pending offer only; acceptance/rejection must be
-- performed by a trusted server-side matching function.
drop policy if exists "provider withdraws own pending offer" on public.job_offers;
create policy "provider withdraws own pending offer" on public.job_offers
for update to authenticated
using (provider_id = (select auth.uid()) and status = 'pending')
with check (provider_id = (select auth.uid()) and status = 'withdrawn');

-- The shared database must not expose provider-facing job discovery through
-- broad table reads. A safe discovery RPC must return only non-sensitive fields.
-- Until that RPC is added, unmatched providers cannot read the jobs table.
