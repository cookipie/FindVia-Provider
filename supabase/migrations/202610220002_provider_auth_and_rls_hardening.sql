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

-- Customers can create only open, unmatched jobs. Matching and completion
-- state must be written by trusted server-side functions.
drop policy if exists "customer creates own jobs" on public.jobs;
create policy "customer creates own open jobs" on public.jobs
for insert to authenticated
with check (
  customer_id = (select auth.uid())
  and public.has_role('customer')
  and status = 'open'
  and matched_provider_id is null
  and completion_verified_at is null
);

create or replace function public.guard_customer_job_state()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.has_role('management') and (
    new.customer_id is distinct from old.customer_id
    or new.status is distinct from old.status
    or new.matched_provider_id is distinct from old.matched_provider_id
    or new.completion_verified_at is distinct from old.completion_verified_at
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Job lifecycle fields can only be changed by trusted server-side actions';
  end if;
  return new;
end;
$$;

drop trigger if exists customer_job_state_guard on public.jobs;
create trigger customer_job_state_guard
before update on public.jobs
for each row execute function public.guard_customer_job_state();

-- An offer submitted from a provider client must start as pending.
drop policy if exists "verified providers submit own offer" on public.job_offers;
create policy "verified providers submit own pending offer" on public.job_offers
for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and status = 'pending'
  and public.has_role('provider')
  and exists (
    select 1 from public.provider_profiles p
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
      and p.service_area_id = j.service_area_id
  )
);

-- The verification guard also applies to INSERT, preventing a client from
-- creating an already-approved provider profile.
create or replace function public.guard_provider_verification_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.has_role('management') then
    if tg_op = 'INSERT' then
      if new.verification_status <> 'not_submitted'
        or new.verification_note is not null
        or new.verified_at is not null then
        raise exception 'Only management can set provider verification fields';
      end if;
    elsif
      new.verification_status is distinct from old.verification_status
      or new.verification_note is distinct from old.verification_note
      or new.verified_at is distinct from old.verified_at then
      raise exception 'Only management can change provider verification fields';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists provider_verification_fields_guard on public.provider_profiles;
create trigger provider_verification_fields_guard
before insert or update on public.provider_profiles
for each row execute function public.guard_provider_verification_fields();

-- Validate recharge data at the database boundary, not only in the UI.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'recharge_amount_range_check'
      and conrelid = 'public.recharge_requests'::regclass
  ) then
    alter table public.recharge_requests
      add constraint recharge_amount_range_check check (amount >= 100 and amount <= 50000);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'recharge_utr_length_check'
      and conrelid = 'public.recharge_requests'::regclass
  ) then
    alter table public.recharge_requests
      add constraint recharge_utr_length_check check (length(btrim(utr)) between 8 and 22);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'commission_effective_window_check'
      and conrelid = 'public.commission_rules'::regclass
  ) then
    alter table public.commission_rules
      add constraint commission_effective_window_check
      check (effective_until is null or effective_until > effective_from);
  end if;
end
$$;

-- Safe provider job discovery. The function intentionally omits exact address,
-- customer contact details and free-form description text.
alter table public.jobs
  add column if not exists title text not null default 'Service request';

create or replace function public.provider_available_jobs()
returns table (
  id uuid,
  title text,
  category_id uuid,
  category_name_en text,
  category_name_hi text,
  icon_name text,
  city text,
  area_name text,
  budget_min numeric,
  budget_max numeric,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    j.id,
    j.title,
    c.id,
    c.name_en,
    c.name_hi,
    c.icon_name,
    j.city,
    j.area_name,
    j.budget_min,
    j.budget_max,
    j.created_at
  from public.jobs j
  join public.service_categories c on c.id = j.category_id and c.is_active
  join public.provider_profiles p on p.user_id = (select auth.uid())
  join public.provider_services ps
    on ps.provider_id = p.user_id and ps.category_id = j.category_id
  where (select auth.uid()) is not null
    and public.has_role('provider')
    and p.verification_status = 'approved'
    and p.is_available
    and p.service_area_id is not null
    and j.service_area_id = p.service_area_id
    and j.status = 'open'
  order by j.created_at desc;
$$;

revoke all on function public.provider_available_jobs() from public;
grant execute on function public.provider_available_jobs() to authenticated;

-- Safe view of the provider's own offers, including the public job title and
-- area without exposing the customer's address or contact information.
create or replace function public.provider_my_offers()
returns table (
  job_id uuid,
  job_title text,
  offered_price numeric,
  message text,
  status public.offer_status,
  created_at timestamptz,
  city text,
  area_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.job_id, j.title, o.offered_price, o.message, o.status, o.created_at, j.city, j.area_name
  from public.job_offers o
  join public.jobs j on j.id = o.job_id
  where o.provider_id = (select auth.uid())
    and public.has_role('provider')
  order by o.created_at desc;
$$;

revoke all on function public.provider_my_offers() from public;
grant execute on function public.provider_my_offers() to authenticated;
