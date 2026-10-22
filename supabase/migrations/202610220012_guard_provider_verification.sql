-- FindVia Provider: prevent providers from approving their own verification.
-- Apply after 202610220011_wallet_commission_settlement.sql.
-- Management can review verification status; providers may upload documents but
-- cannot change verification_status, verification_note, or verified_at directly.

create or replace function public.guard_provider_verification_fields()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.has_role('management') then
    if tg_op = 'INSERT' then
      if new.verification_status <> 'not_submitted'::public.verification_status
        or new.verification_note is not null
        or new.verified_at is not null then
        raise exception 'Only management can set provider verification status';
      end if;
    else
      if new.verification_status is distinct from old.verification_status
        or new.verification_note is distinct from old.verification_note
        or new.verified_at is distinct from old.verified_at then
        raise exception 'Only management can change provider verification status';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists provider_verification_fields_guard on public.provider_profiles;
create trigger provider_verification_fields_guard
before insert or update on public.provider_profiles
for each row execute function public.guard_provider_verification_fields();

revoke all on function public.guard_provider_verification_fields() from public, anon, authenticated;
