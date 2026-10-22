-- FindVia: atomic offer acceptance and post-match contact access.
-- Customer selection is the single secure matching action. Client apps cannot
-- directly mark jobs matched or reveal contact details for unmatched jobs.

create or replace function public.customer_accept_job_offer(p_offer_id uuid)
returns table (
  job_id uuid,
  match_id uuid,
  provider_id uuid,
  agreed_price numeric
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_job public.jobs%rowtype;
  v_offer public.job_offers%rowtype;
  v_match_id uuid;
begin
  if v_user_id is null or not public.has_role('customer') then
    raise exception 'Customer sign-in is required';
  end if;

  select j.* into v_job
  from public.jobs j
  join public.job_offers o on o.job_id = j.id
  where o.id = p_offer_id
  for update of j;

  if not found then
    raise exception 'Offer or job not found';
  end if;
  if v_job.customer_id <> v_user_id then
    raise exception 'You can only accept an offer on your own job';
  end if;
  if v_job.status <> 'open' or v_job.matched_provider_id is not null then
    raise exception 'This job is no longer available for matching';
  end if;

  select o.* into v_offer
  from public.job_offers o
  where o.id = p_offer_id and o.job_id = v_job.id
  for update;

  if not found or v_offer.status <> 'pending' then
    raise exception 'This offer is no longer available';
  end if;

  if not exists (
    select 1 from public.provider_profiles p
    where p.user_id = v_offer.provider_id
      and p.verification_status = 'approved'
      and p.is_available
  ) then
    raise exception 'This provider is not currently eligible';
  end if;

  update public.job_offers
  set status = case when id = p_offer_id then 'accepted'::public.offer_status
                    else 'rejected'::public.offer_status end,
      updated_at = now()
  where job_offers.job_id = v_job.id
    and status = 'pending';

  update public.jobs
  set status = 'matched',
      matched_provider_id = v_offer.provider_id,
      updated_at = now()
  where id = v_job.id and status = 'open';

  if not found then
    raise exception 'The job was already matched; refresh and try again';
  end if;

  insert into public.job_matches
    (job_id, customer_id, provider_id, accepted_offer_id, agreed_price)
  values
    (v_job.id, v_user_id, v_offer.provider_id, v_offer.id, v_offer.offered_price)
  returning id into v_match_id;

  insert into public.notifications(user_id, title, body, event_type, related_job_id)
  values
    (v_offer.provider_id, 'Offer accepted', 'The customer accepted your offer. Open FindVia to view the matched job.', 'offer_accepted', v_job.id),
    (v_user_id, 'Provider matched', 'Your selected provider has been matched to this job.', 'job_matched', v_job.id);

  return query select v_job.id, v_match_id, v_offer.provider_id, v_offer.offered_price;
end;
$$;

revoke all on function public.customer_accept_job_offer(uuid) from public, anon;
grant execute on function public.customer_accept_job_offer(uuid) to authenticated;

-- Contact details are returned only to the customer or selected provider after
-- a match exists. Unmatched providers cannot use this RPC to discover contacts.
create or replace function public.get_matched_job_contact(p_job_id uuid)
returns table (
  job_id uuid,
  job_status public.job_status,
  customer_name text,
  customer_phone text,
  job_address text,
  provider_name text,
  provider_phone text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_job public.jobs%rowtype;
begin
  if v_user_id is null then
    raise exception 'Sign-in is required';
  end if;

  select j.* into v_job
  from public.jobs j
  join public.job_matches m on m.job_id = j.id
  where j.id = p_job_id
    and (j.customer_id = v_user_id or m.provider_id = v_user_id)
  limit 1;

  if not found then
    raise exception 'Matched job not found or access denied';
  end if;

  return query
  select
    v_job.id,
    v_job.status,
    case when v_job.customer_id = v_user_id or exists (
      select 1 from public.job_matches m where m.job_id = v_job.id and m.provider_id = v_user_id
    ) then cp.full_name else null end,
    case when v_job.customer_id = v_user_id or exists (
      select 1 from public.job_matches m where m.job_id = v_job.id and m.provider_id = v_user_id
    ) then cp.phone else null end,
    v_job.address,
    case when v_job.customer_id = v_user_id or exists (
      select 1 from public.job_matches m where m.job_id = v_job.id and m.provider_id = v_user_id
    ) then pp.full_name else null end,
    case when v_job.customer_id = v_user_id or exists (
      select 1 from public.job_matches m where m.job_id = v_job.id and m.provider_id = v_user_id
    ) then pp.phone else null end
  from public.profiles cp
  join public.profiles pp on pp.id = v_job.matched_provider_id
  where cp.id = v_job.customer_id;
end;
$$;

revoke all on function public.get_matched_job_contact(uuid) from public, anon;
grant execute on function public.get_matched_job_contact(uuid) to authenticated;
