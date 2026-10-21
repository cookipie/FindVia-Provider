-- FindVia shared backend — initial schema
-- Apply once in Supabase SQL Editor for the new shared project.
-- All three apps use this one database. Never put secret/service_role keys in client apps.

create extension if not exists pgcrypto;

create type public.app_role as enum ('customer', 'provider', 'management');
create type public.job_status as enum ('open', 'matched', 'in_progress', 'completed', 'cancelled', 'disputed');
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');
create type public.verification_status as enum ('not_submitted', 'pending', 'approved', 'rejected', 'suspended');
create type public.commission_type as enum ('percentage', 'fixed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  phone text,
  avatar_url text,
  preferred_language text not null default 'hi' check (preferred_language in ('hi','en')),
  account_status text not null default 'active' check (account_status in ('active','suspended','closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.service_categories(id) on delete set null,
  name_en text not null,
  name_hi text not null,
  slug text not null unique,
  description text,
  icon_name text not null default 'wrench',
  is_active boolean not null default true,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_areas (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  area_name text not null,
  state text not null,
  country text not null default 'India',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (city, area_name, state, country)
);

create table public.provider_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  bio text,
  experience_years integer not null default 0 check (experience_years >= 0),
  verification_status public.verification_status not null default 'not_submitted',
  verification_note text,
  service_area_id uuid references public.service_areas(id) on delete set null,
  is_available boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_services (
  provider_id uuid not null references public.provider_profiles(user_id) on delete cascade,
  category_id uuid not null references public.service_categories(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (provider_id, category_id)
);

create table public.jobs (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  category_id uuid not null references public.service_categories(id) on delete restrict,
  service_area_id uuid references public.service_areas(id) on delete set null,
  city text not null,
  area_name text not null,
  address text,
  description text not null,
  budget_min numeric(12,2) check (budget_min is null or budget_min >= 0),
  budget_max numeric(12,2) check (budget_max is null or budget_max >= 0),
  status public.job_status not null default 'open',
  matched_provider_id uuid references public.provider_profiles(user_id) on delete set null,
  completion_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (budget_min is null or budget_max is null or budget_min <= budget_max)
);

create table public.job_offers (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(user_id) on delete restrict,
  offered_price numeric(12,2) not null check (offered_price >= 0),
  message text,
  status public.offer_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, provider_id)
);

create table public.job_matches (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete restrict,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(user_id) on delete restrict,
  accepted_offer_id uuid unique references public.job_offers(id) on delete restrict,
  matched_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  agreed_price numeric(12,2) not null check (agreed_price >= 0)
);

create table public.commission_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  commission_type public.commission_type not null,
  percentage numeric(5,2) check (percentage is null or (percentage >= 0 and percentage <= 100)),
  fixed_amount numeric(12,2) check (fixed_amount is null or fixed_amount >= 0),
  category_id uuid references public.service_categories(id) on delete cascade,
  priority integer not null default 100,
  is_active boolean not null default true,
  effective_from timestamptz not null default now(),
  effective_until timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  check (
    (commission_type = 'percentage' and percentage is not null and fixed_amount is null)
    or (commission_type = 'fixed' and fixed_amount is not null and percentage is null)
  )
);

create table public.wallet_accounts (
  provider_id uuid primary key references public.provider_profiles(user_id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  currency text not null default 'INR' check (currency = 'INR'),
  updated_at timestamptz not null default now()
);

create table public.wallet_ledger (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(user_id) on delete restrict,
  amount numeric(12,2) not null check (amount <> 0),
  entry_type text not null check (entry_type in ('recharge', 'commission', 'refund', 'adjustment', 'withdrawal')),
  reference_type text,
  reference_id uuid,
  description text not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.recharge_requests (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(user_id) on delete restrict,
  amount numeric(12,2) not null check (amount > 0),
  utr text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (utr)
);

create table public.completion_otps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(user_id) on delete restrict,
  otp_hash text not null,
  expires_at timestamptz not null,
  attempts integer not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text not null,
  event_type text not null,
  related_job_id uuid references public.jobs(id) on delete set null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index jobs_status_created_idx on public.jobs(status, created_at desc);
create index jobs_area_category_idx on public.jobs(service_area_id, category_id);
create index offers_job_created_idx on public.job_offers(job_id, created_at desc);
create index offers_provider_created_idx on public.job_offers(provider_id, created_at desc);
create index ledger_provider_created_idx on public.wallet_ledger(provider_id, created_at desc);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index audit_created_idx on public.admin_audit_logs(created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger provider_profiles_updated_at before update on public.provider_profiles
for each row execute function public.set_updated_at();

-- A provider must never be able to self-approve by editing their own profile.
create or replace function public.guard_provider_verification_fields()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if not public.has_role('management') and (
    new.verification_status is distinct from old.verification_status
    or new.verification_note is distinct from old.verification_note
    or new.verified_at is distinct from old.verified_at
  ) then
    raise exception 'Only management can change provider verification fields';
  end if;
  return new;
end;
$$;

create trigger provider_verification_fields_guard
before update on public.provider_profiles
for each row execute function public.guard_provider_verification_fields();
create trigger categories_updated_at before update on public.service_categories
for each row execute function public.set_updated_at();
create trigger jobs_updated_at before update on public.jobs
for each row execute function public.set_updated_at();
create trigger offers_updated_at before update on public.job_offers
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, phone)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.has_role(required_role public.app_role)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = (select auth.uid()) and role = required_role
  );
$$;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.service_categories enable row level security;
alter table public.service_areas enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_services enable row level security;
alter table public.jobs enable row level security;
alter table public.job_offers enable row level security;
alter table public.job_matches enable row level security;
alter table public.commission_rules enable row level security;
alter table public.wallet_accounts enable row level security;
alter table public.wallet_ledger enable row level security;
alter table public.recharge_requests enable row level security;
alter table public.completion_otps enable row level security;
alter table public.notifications enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_audit_logs enable row level security;

-- Self access; elevated actions are reserved for trusted server-side functions/management role.
create policy "profiles read own or management" on public.profiles for select to authenticated
using (id = (select auth.uid()) or public.has_role('management'));
create policy "profiles update own" on public.profiles for update to authenticated
using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "users read own roles" on public.user_roles for select to authenticated
using (user_id = (select auth.uid()) or public.has_role('management'));

create policy "active categories visible" on public.service_categories for select to anon, authenticated
using (is_active or public.has_role('management'));
create policy "management manages categories" on public.service_categories for all to authenticated
using (public.has_role('management')) with check (public.has_role('management'));
create policy "active areas visible" on public.service_areas for select to anon, authenticated
using (is_active or public.has_role('management'));
create policy "management manages areas" on public.service_areas for all to authenticated
using (public.has_role('management')) with check (public.has_role('management'));

create policy "provider profile visible to owner or management" on public.provider_profiles for select to authenticated
using (user_id = (select auth.uid()) or public.has_role('management'));
create policy "provider updates own non-verification fields" on public.provider_profiles for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "provider creates own profile" on public.provider_profiles for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "provider manages own services" on public.provider_services for all to authenticated
using (provider_id = (select auth.uid())) with check (provider_id = (select auth.uid()));
create policy "management reads all provider services" on public.provider_services for select to authenticated
using (public.has_role('management'));

create policy "customer sees own jobs; matched provider sees job; management sees all" on public.jobs for select to authenticated
using (customer_id = (select auth.uid()) or matched_provider_id = (select auth.uid()) or public.has_role('management'));
create policy "customer creates own jobs" on public.jobs for insert to authenticated
with check (customer_id = (select auth.uid()) and public.has_role('customer'));
create policy "customer updates own open jobs" on public.jobs for update to authenticated
using (customer_id = (select auth.uid()) and status = 'open')
with check (customer_id = (select auth.uid()));
create policy "management manages jobs" on public.jobs for all to authenticated
using (public.has_role('management')) with check (public.has_role('management'));

create policy "offers visible to owner customer or management" on public.job_offers for select to authenticated
using (
  provider_id = (select auth.uid())
  or public.has_role('management')
  or exists (select 1 from public.jobs j where j.id = job_id and j.customer_id = (select auth.uid()))
);
create policy "verified providers submit own offer" on public.job_offers for insert to authenticated
with check (
  provider_id = (select auth.uid())
  and exists (select 1 from public.provider_profiles p where p.user_id = (select auth.uid()) and p.verification_status = 'approved')
  and exists (select 1 from public.jobs j where j.id = job_id and j.status = 'open')
);
create policy "provider withdraws own pending offer" on public.job_offers for update to authenticated
using (provider_id = (select auth.uid()) and status = 'pending')
with check (provider_id = (select auth.uid()));
create policy "management manages offers" on public.job_offers for all to authenticated
using (public.has_role('management')) with check (public.has_role('management'));

create policy "matches visible to participants or management" on public.job_matches for select to authenticated
using (customer_id = (select auth.uid()) or provider_id = (select auth.uid()) or public.has_role('management'));

create policy "active commission rules readable to authenticated" on public.commission_rules for select to authenticated
using ((is_active and now() >= effective_from and (effective_until is null or now() < effective_until)) or public.has_role('management'));
create policy "management manages commission rules" on public.commission_rules for all to authenticated
using (public.has_role('management')) with check (public.has_role('management'));

create policy "provider reads own wallet" on public.wallet_accounts for select to authenticated
using (provider_id = (select auth.uid()) or public.has_role('management'));
create policy "provider reads own ledger" on public.wallet_ledger for select to authenticated
using (provider_id = (select auth.uid()) or public.has_role('management'));
create policy "provider reads own recharge requests" on public.recharge_requests for select to authenticated
using (provider_id = (select auth.uid()) or public.has_role('management'));
create policy "provider creates own recharge request" on public.recharge_requests for insert to authenticated
with check (provider_id = (select auth.uid()));
create policy "management manages recharge requests" on public.recharge_requests for all to authenticated
using (public.has_role('management')) with check (public.has_role('management'));

create policy "participants can see otp metadata only" on public.completion_otps for select to authenticated
using (customer_id = (select auth.uid()) or provider_id = (select auth.uid()) or public.has_role('management'));
create policy "users read own notifications" on public.notifications for select to authenticated
using (user_id = (select auth.uid()) or public.has_role('management'));
create policy "users mark own notifications read" on public.notifications for update to authenticated
using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "management reads app settings" on public.app_settings for select to authenticated
using (true);
create policy "management manages app settings" on public.app_settings for all to authenticated
using (public.has_role('management')) with check (public.has_role('management'));
create policy "management reads audit log" on public.admin_audit_logs for select to authenticated
using (public.has_role('management'));

-- Baseline settings; only management can change these after an authorized role is assigned.
insert into public.app_settings(key, value, description) values
('wallet_currency', '"INR"'::jsonb, 'Currency used by provider wallets'),
('provider_verification_required', 'true'::jsonb, 'Providers must be approved before sending offers'),
('default_commission_type', '"percentage"'::jsonb, 'Default commission calculation mode'),
('default_commission_percentage', '10'::jsonb, 'Default percentage commission; management can change it'),
('default_commission_fixed_amount', '0'::jsonb, 'Default fixed commission amount in INR'),
('contact_visible_only_after_match', 'true'::jsonb, 'Hide direct contact and exact address until a job is matched')
on conflict (key) do nothing;

-- Important security notes:
-- 1. Do not grant management role from a client app. Assign the first management role only
--    through a trusted administrative process after confirming the correct auth user UUID.
-- 2. OTP generation/verification, match acceptance, wallet balance changes and commission
--    deductions must be implemented as transactional server-side functions before production.
-- 3. This starter schema does not yet expose job discovery or exact addresses to unmatched providers.
