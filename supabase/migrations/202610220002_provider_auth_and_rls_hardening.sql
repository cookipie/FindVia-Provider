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

-- Providers may submit a pending recharge request only; approval metadata is
-- exclusively controlled by management.
drop policy if exists "provider creates own recharge request" on public.recharge_requests;
create policy "provider creates own pending recharge request" on public.recharge_requests
for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and status = 'pending'
  and reviewed_by is null
  and reviewed_at is null
  and admin_note is null
);

-- Notification recipients may mark their own notifications read, but cannot
-- rewrite notification content or change ownership from the client.
create or replace function public.guard_notification_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.has_role('management') and (
    new.user_id is distinct from old.user_id
    or new.title is distinct from old.title
    or new.body is distinct from old.body
    or new.event_type is distinct from old.event_type
    or new.related_job_id is distinct from old.related_job_id
    or new.created_at is distinct from old.created_at
    or (old.read_at is not null and new.read_at is distinct from old.read_at)
  ) then
    raise exception 'Recipients may only mark their own notifications as read';
  end if;
  return new;
end;
$$;

drop trigger if exists notification_update_guard on public.notifications;
create trigger notification_update_guard
before update on public.notifications
for each row execute function public.guard_notification_update();

-- Prevent users from reactivating or closing accounts by editing their own
-- profile row directly.
create or replace function public.guard_profile_account_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.has_role('management')
    and new.account_status is distinct from old.account_status then
    raise exception 'Only management can change account status';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_account_status_guard on public.profiles;
create trigger profile_account_status_guard
before update on public.profiles
for each row execute function public.guard_profile_account_status();

-- Explicitly require provider role for provider-only profile/service mutations.
drop policy if exists "provider creates own profile" on public.provider_profiles;
create policy "provider creates own profile" on public.provider_profiles
for insert to authenticated
with check (user_id = (select auth.uid()) and public.has_role('provider'));

drop policy if exists "provider updates own non-verification fields" on public.provider_profiles;
create policy "provider updates own non-verification fields" on public.provider_profiles
for update to authenticated
using (user_id = (select auth.uid()) and public.has_role('provider'))
with check (user_id = (select auth.uid()) and public.has_role('provider'));

drop policy if exists "provider manages own services" on public.provider_services;
create policy "provider manages own services" on public.provider_services
for all to authenticated
using (provider_id = (select auth.uid()) and public.has_role('provider'))
with check (provider_id = (select auth.uid()) and public.has_role('provider'));
