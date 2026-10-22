-- FindVia Provider: return the actual job title in the matched-work list.
-- Migration 007 accidentally mapped the job description to job_title.
-- Keep the return signature unchanged so the existing Provider UI remains compatible.

create or replace function public.provider_my_matches()
returns table (
  match_id uuid,
  job_id uuid,
  job_title text,
  category_name_en text,
  category_name_hi text,
  city text,
  area_name text,
  job_status public.job_status,
  agreed_price numeric,
  matched_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  customer_name text,
  customer_phone text,
  job_address text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null or not public.has_role('provider') then
    raise exception 'Provider sign-in is required';
  end if;

  return query
  select
    m.id,
    j.id,
    j.title,
    c.name_en,
    c.name_hi,
    j.city,
    j.area_name,
    j.status,
    m.agreed_price,
    m.matched_at,
    m.started_at,
    m.completed_at,
    cp.full_name,
    cp.phone,
    j.address
  from public.job_matches m
  join public.jobs j on j.id = m.job_id
  join public.profiles cp on cp.id = m.customer_id
  join public.service_categories c on c.id = j.category_id
  where m.provider_id = v_user_id
  order by m.matched_at desc;
end;
$$;

revoke all on function public.provider_my_matches() from public, anon;
grant execute on function public.provider_my_matches() to authenticated;
