-- FindVia: wallet-backed commission accounting and management-controlled recharge review.
-- A completed job is never blocked by a low wallet balance: any unpaid commission remains due
-- and is settled automatically from later approved recharges.
create table if not exists public.provider_commission_charges (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null unique references public.jobs(id) on delete restrict,
  provider_id uuid not null references public.provider_profiles(user_id) on delete restrict,
  job_price numeric(12,2) not null check (job_price >= 0),
  commission_amount numeric(12,2) not null check (commission_amount >= 0),
  settled_amount numeric(12,2) not null default 0 check (settled_amount >= 0 and settled_amount <= commission_amount),
  commission_type public.commission_type not null,
  commission_rate numeric(12,2),
  status text not null default 'pending' check (status in ('pending','paid')),
  created_at timestamptz not null default now(),
  settled_at timestamptz
);

create index if not exists provider_commission_due_idx
on public.provider_commission_charges(provider_id, status, created_at);

alter table public.provider_commission_charges enable row level security;
drop policy if exists "provider reads own commission charges" on public.provider_commission_charges;
create policy "provider reads own commission charges"
on public.provider_commission_charges for select to authenticated
using (provider_id = (select auth.uid()) or public.has_role('management'));

create or replace function public.apply_provider_commission_for_job(p_job_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.jobs%rowtype;
  v_rule public.commission_rules%rowtype;
  v_type public.commission_type;
  v_percentage numeric(5,2);
  v_fixed numeric(12,2);
  v_commission numeric(12,2);
  v_wallet numeric(12,2);
  v_pay numeric(12,2);
  v_charge_id uuid;
begin
  select * into v_job from public.jobs where id = p_job_id;
  if not found or v_job.status <> 'completed' or v_job.matched_provider_id is null then
    return;
  end if;

  if exists (select 1 from public.provider_commission_charges where job_id = p_job_id) then
    return;
  end if;

  select * into v_rule
  from public.commission_rules
  where is_active
    and now() >= effective_from
    and (effective_until is null or now() < effective_until)
    and (category_id = v_job.category_id or category_id is null)
  order by (category_id is not null) desc, priority asc, created_at desc
  limit 1;

  if found then
    v_type := v_rule.commission_type;
    v_percentage := v_rule.percentage;
    v_fixed := v_rule.fixed_amount;
  else
    v_type := case
      when lower(trim(coalesce((select value #>> '{}' from public.app_settings where key = 'default_commission_type'), 'percentage'))) = 'fixed'
      then 'fixed'::public.commission_type else 'percentage'::public.commission_type end;
    v_percentage := coalesce(
      (select (value #>> '{}')::numeric from public.app_settings where key = 'default_commission_percentage'), 10
    );
    v_fixed := coalesce(
      (select (value #>> '{}')::numeric from public.app_settings where key = 'default_commission_fixed_amount'), 0
    );
  end if;

  if v_type = 'fixed' then
    v_commission := least(coalesce((select agreed_price from public.job_matches where job_id = p_job_id), 0), greatest(coalesce(v_fixed, 0), 0));
  else
    v_commission := round(coalesce((select agreed_price from public.job_matches where job_id = p_job_id), 0) * greatest(coalesce(v_percentage, 0), 0) / 100, 2);
  end if;

  insert into public.provider_commission_charges(job_id, provider_id, job_price, commission_amount, commission_type, commission_rate)
  values (
    p_job_id,
    v_job.matched_provider_id,
    coalesce((select agreed_price from public.job_matches where job_id = p_job_id), 0),
    v_commission,
    v_type,
    case when v_type = 'percentage' then v_percentage else v_fixed end
  )
  on conflict (job_id) do nothing
  returning id into v_charge_id;

  if v_charge_id is null then return; end if;

  select balance into v_wallet
  from public.wallet_accounts
  where provider_id = v_job.matched_provider_id
  for update;

  v_wallet := coalesce(v_wallet, 0);
  v_pay := least(v_wallet, v_commission);

  if v_pay > 0 then
    update public.wallet_accounts
    set balance = balance - v_pay, updated_at = now()
    where provider_id = v_job.matched_provider_id;

    insert into public.wallet_ledger(provider_id, amount, entry_type, reference_type, reference_id, description)
    values (
      v_job.matched_provider_id, -v_pay, 'commission', 'job', p_job_id,
      'Platform commission for completed job'
    );
  end if;

  update public.provider_commission_charges
  set settled_amount = v_pay,
      status = case when v_pay >= commission_amount then 'paid' else 'pending' end,
      settled_at = case when v_pay >= commission_amount then now() else null end
  where id = v_charge_id;
end;
$$;

create or replace function public.on_provider_job_completed_charge_commission()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    perform public.apply_provider_commission_for_job(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists provider_job_completed_commission on public.jobs;
create trigger provider_job_completed_commission
after update of status on public.jobs
for each row execute function public.on_provider_job_completed_charge_commission();

-- Only the Management App's trusted role can approve/reject a recharge.
drop policy if exists "management manages recharge requests" on public.recharge_requests;
drop policy if exists "management reads recharge requests" on public.recharge_requests;
create policy "management reads recharge requests"
on public.recharge_requests for select to authenticated
using (public.has_role('management'));

create or replace function public.management_review_recharge_request(
  p_request_id uuid,
  p_approve boolean,
  p_admin_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.recharge_requests%rowtype;
  v_charge public.provider_commission_charges%rowtype;
  v_wallet numeric(12,2);
  v_due numeric(12,2);
  v_pay numeric(12,2);
begin
  if (select auth.uid()) is null or not public.has_role('management') then
    raise exception 'Management access is required';
  end if;

  select * into v_request
  from public.recharge_requests
  where id = p_request_id
  for update;

  if not found then raise exception 'Recharge request not found'; end if;
  if v_request.status <> 'pending' then raise exception 'This recharge request has already been reviewed'; end if;

  if not p_approve then
    update public.recharge_requests
    set status = 'rejected', admin_note = left(nullif(trim(coalesce(p_admin_note, '')), ''), 1000),
        reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_request_id;
  else
    update public.recharge_requests
    set status = 'approved', admin_note = left(nullif(trim(coalesce(p_admin_note, '')), ''), 1000),
        reviewed_by = (select auth.uid()), reviewed_at = now()
    where id = p_request_id;

    insert into public.wallet_accounts(provider_id, balance, currency)
    values (v_request.provider_id, 0, 'INR')
    on conflict (provider_id) do nothing;

    select balance into v_wallet
    from public.wallet_accounts
    where provider_id = v_request.provider_id
    for update;

    update public.wallet_accounts
    set balance = balance + v_request.amount, updated_at = now()
    where provider_id = v_request.provider_id;

    insert into public.wallet_ledger(provider_id, amount, entry_type, reference_type, reference_id, description, created_by)
    values (v_request.provider_id, v_request.amount, 'recharge', 'recharge_request', p_request_id, 'Approved wallet recharge', (select auth.uid()));

    v_wallet := coalesce(v_wallet, 0) + v_request.amount;

    for v_charge in
      select * from public.provider_commission_charges
      where provider_id = v_request.provider_id and status = 'pending'
      order by created_at asc
      for update
    loop
      v_due := v_charge.commission_amount - v_charge.settled_amount;
      v_pay := least(v_wallet, v_due);
      if v_pay > 0 then
        update public.wallet_accounts
        set balance = balance - v_pay, updated_at = now()
        where provider_id = v_request.provider_id;
        insert into public.wallet_ledger(provider_id, amount, entry_type, reference_type, reference_id, description, created_by)
        values (v_request.provider_id, -v_pay, 'commission', 'job', v_charge.job_id, 'Settlement of outstanding job commission', (select auth.uid()));
        update public.provider_commission_charges
        set settled_amount = settled_amount + v_pay,
            status = case when settled_amount + v_pay >= commission_amount then 'paid' else 'pending' end,
            settled_at = case when settled_amount + v_pay >= commission_amount then now() else null end
        where id = v_charge.id;
        v_wallet := v_wallet - v_pay;
      end if;
      exit when v_wallet <= 0;
    end loop;

    insert into public.notifications(user_id, title, body, event_type)
    values (
      v_request.provider_id,
      'Wallet recharge approved',
      'Your wallet recharge has been approved. Any outstanding commission was settled from the wallet where funds were available.',
      'wallet_recharge_approved'
    );
  end if;

  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, details)
  values (
    (select auth.uid()),
    case when p_approve then 'recharge_approved' else 'recharge_rejected' end,
    'recharge_request',
    p_request_id::text,
    jsonb_build_object('provider_id', v_request.provider_id, 'amount', v_request.amount, 'admin_note', left(coalesce(p_admin_note, ''), 1000))
  );
end;
$$;

revoke all on function public.apply_provider_commission_for_job(uuid) from public, anon, authenticated;
revoke all on function public.on_provider_job_completed_charge_commission() from public, anon, authenticated;
revoke all on function public.management_review_recharge_request(uuid, boolean, text) from public, anon;
grant execute on function public.management_review_recharge_request(uuid, boolean, text) to authenticated;
