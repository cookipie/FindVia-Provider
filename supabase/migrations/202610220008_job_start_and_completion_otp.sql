-- FindVia: controlled job start and one-time completion verification.
-- Customer sees the completion code; provider can only submit a code for their matched job.
create or replace function public.provider_start_matched_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_job public.jobs%rowtype;
begin
  if v_user_id is null or not public.has_role('provider') then
    raise exception 'Provider sign-in is required';
  end if;

  select j.* into v_job
  from public.jobs j
  join public.job_matches m on m.job_id = j.id and m.provider_id = v_user_id
  where j.id = p_job_id
  for update of j;

  if not found then
    raise exception 'This job is not matched to your account';
  end if;
  if v_job.status <> 'matched' then
    raise exception 'Only a matched job can be started';
  end if;

  update public.jobs set status = 'in_progress', updated_at = now()
  where id = p_job_id and status = 'matched';

  update public.job_matches set started_at = now()
  where job_id = p_job_id and provider_id = v_user_id and started_at is null;

  insert into public.notifications(user_id, title, body, event_type, related_job_id)
  values (v_job.customer_id, 'Work started', 'Your selected provider has started the job.', 'job_started', p_job_id);
end;
$$;

create or replace function public.customer_generate_completion_otp(p_job_id uuid)
returns table (otp text, expires_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_job public.jobs%rowtype;
  v_otp text;
  v_expires timestamptz;
begin
  if v_user_id is null or not public.has_role('customer') then
    raise exception 'Customer sign-in is required';
  end if;

  select j.* into v_job
  from public.jobs j
  join public.job_matches m on m.job_id = j.id and m.customer_id = v_user_id
  where j.id = p_job_id
  for update of j;

  if not found then
    raise exception 'This job is not matched to your account';
  end if;
  if v_job.status <> 'in_progress' then
    raise exception 'Completion code is available only while work is active';
  end if;

  if exists (
    select 1 from public.completion_otps o
    where o.job_id = p_job_id and o.consumed_at is null and o.expires_at > now()
  ) then
    raise exception 'A valid completion code already exists; use that code or wait for expiry';
  end if;

  v_otp := lpad((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000)::text, 6, '0');
  v_expires := now() + interval '15 minutes';

  insert into public.completion_otps(job_id, customer_id, provider_id, otp_hash, expires_at)
  values (p_job_id, v_user_id, v_job.matched_provider_id, encode(extensions.digest(v_otp, 'sha256'), 'hex'), v_expires);

  insert into public.notifications(user_id, title, body, event_type, related_job_id)
  values (v_job.matched_provider_id, 'Completion code requested', 'Ask the customer for the in-app completion code after the work is finished.', 'completion_otp_requested', p_job_id);

  return query select v_otp, v_expires;
end;
$$;

create or replace function public.provider_verify_completion_otp(p_job_id uuid, p_otp text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_job public.jobs%rowtype;
  v_code public.completion_otps%rowtype;
begin
  if v_user_id is null or not public.has_role('provider') then
    raise exception 'Provider sign-in is required';
  end if;
  if p_otp !~ '^[0-9]{6}$' then
    raise exception 'Enter the 6-digit completion code';
  end if;

  select j.* into v_job
  from public.jobs j
  join public.job_matches m on m.job_id = j.id and m.provider_id = v_user_id
  where j.id = p_job_id
  for update of j;

  if not found or v_job.status <> 'in_progress' then
    raise exception 'This active job is not matched to your account';
  end if;

  select o.* into v_code
  from public.completion_otps o
  where o.job_id = p_job_id
    and o.provider_id = v_user_id
    and o.consumed_at is null
    and o.expires_at > now()
  order by o.created_at desc
  limit 1
  for update;

  if not found then
    raise exception 'No valid completion code found; ask the customer to generate one';
  end if;

  if v_code.attempts >= 5 then
    raise exception 'Too many attempts; ask the customer to generate a new code after expiry';
  end if;

  if v_code.otp_hash <> encode(extensions.digest(p_otp, 'sha256'), 'hex') then
    update public.completion_otps set attempts = attempts + 1 where id = v_code.id;
    raise exception 'Incorrect completion code';
  end if;

  update public.completion_otps set consumed_at = now() where id = v_code.id;
  update public.jobs set status = 'completed', completion_verified_at = now(), updated_at = now()
  where id = p_job_id;
  update public.job_matches set completed_at = now()
  where job_id = p_job_id and provider_id = v_user_id;

  insert into public.notifications(user_id, title, body, event_type, related_job_id)
  values
    (v_job.customer_id, 'Work completed', 'The completion code was verified and the job is marked complete.', 'job_completed', p_job_id),
    (v_user_id, 'Work completed', 'The completion code was verified and the job is marked complete.', 'job_completed', p_job_id);
end;
$$;

revoke all on function public.provider_start_matched_job(uuid) from public, anon;
revoke all on function public.customer_generate_completion_otp(uuid) from public, anon;
revoke all on function public.provider_verify_completion_otp(uuid, text) from public, anon;
grant execute on function public.provider_start_matched_job(uuid) to authenticated;
grant execute on function public.customer_generate_completion_otp(uuid) to authenticated;
grant execute on function public.provider_verify_completion_otp(uuid, text) to authenticated;
