-- Repair: replace the completion-code verifier with a correctly delimited function.
create or replace function public.provider_verify_completion_otp(p_job_id uuid, p_otp text)
returns boolean
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
    return false;
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
  return true;
end;
$$;

revoke all on function public.provider_verify_completion_otp(uuid, text) from public, anon;
grant execute on function public.provider_verify_completion_otp(uuid, text) to authenticated;
